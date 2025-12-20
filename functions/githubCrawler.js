const {onRequest} = require("firebase-functions/v2/https");
const {defineString} = require("firebase-functions/params");
const {Octokit} = require("@octokit/rest");
const axios = require("axios");
const matter = require("gray-matter");
const admin = require("firebase-admin");
const {classifyContent} = require("./llm");
const {addDocumentsToIndex} = require("./rag");

// GitHub configuration
const GITHUB_OWNER = "flutter";
const GITHUB_REPO = "website";
const GITHUB_BRANCH = "main";
const DOCS_PATH = "src"; // Flutter website docs path

// Define GitHub token parameter
const githubToken = defineString("GITHUB_TOKEN", {
  default: "",
});

// Note: Octokit will be initialized inside the function with the token

/**
 * Fetch file tree from GitHub repository
 * @param {Octokit} octokit - GitHub API client
 * @return {Promise<Array>} Array of markdown file objects
 */
async function fetchGitHubFileTree(octokit) {
  try {
    console.log(`Fetching file tree from ${GITHUB_OWNER}/${GITHUB_REPO}...`);

    const {data} = await octokit.git.getTree({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      tree_sha: GITHUB_BRANCH,
      recursive: "true",
    });

    // Filter for markdown files in docs directory
    const markdownFiles = data.tree
        .filter((file) =>
          file.path.startsWith(DOCS_PATH) &&
        file.path.endsWith(".md") &&
        file.type === "blob",
        )
        .map((file) => ({
          path: file.path,
          sha: file.sha,
          url: file.url,
          size: file.size,
        }));

    console.log(`Found ${markdownFiles.length} markdown files`);
    return markdownFiles;
  } catch (error) {
    console.error("Error fetching GitHub file tree:", error.message);
    throw error;
  }
}

/**
 * Download file content from GitHub
 * @param {string} filePath - File path in repository
 * @return {Promise<string>} File content
 */
async function downloadFileContent(filePath) {
  try {
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`;

    const response = await axios.get(rawUrl, {
      timeout: 10000,
      headers: {
        "User-Agent": "Flutter-Chatbot-Crawler/2.0",
      },
    });

    return response.data;
  } catch (error) {
    console.error(`Error downloading ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Get latest commit SHA for a file
 * @param {Octokit} octokit - GitHub API client
 * @param {string} filePath - File path
 * @return {Promise<string>} Commit SHA
 */
async function getLatestCommitSha(octokit, filePath) {
  try {
    const {data} = await octokit.repos.listCommits({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      per_page: 1,
    });

    return data.length > 0 ? data[0].sha : null;
  } catch (error) {
    console.error(`Error getting commit SHA for ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Check if file needs refresh based on commit SHA
 * @param {string} filePath - File path
 * @param {string} latestCommitSha - Latest commit SHA from GitHub
 * @return {Promise<boolean>} True if needs refresh
 */
async function needsRefresh(filePath, latestCommitSha) {
  try {
    const db = admin.firestore();
    const docId = encodeURIComponent(filePath);
    const statusDoc = await db.collection("github_sync_status").doc(docId).get();

    if (!statusDoc.exists) {
      return true; // New file
    }

    const statusData = statusDoc.data();
    const lastCommitSha = statusData.lastCommitSha;

    // Compare commit SHAs
    return lastCommitSha !== latestCommitSha;
  } catch (error) {
    console.error(`Error checking refresh status for ${filePath}:`, error);
    return true; // Default to refresh on error
  }
}

/**
 * Update sync status in Firestore
 * @param {string} filePath - File path
 * @param {string} commitSha - Commit SHA
 * @param {boolean} success - Sync success status
 * @param {number} chunkCount - Number of chunks created
 */
async function updateSyncStatus(filePath, commitSha, success, chunkCount = 0) {
  try {
    const db = admin.firestore();
    const docId = encodeURIComponent(filePath);

    await db.collection("github_sync_status").doc(docId).set({
      filePath: filePath,
      lastCommitSha: commitSha,
      lastSynced: admin.firestore.FieldValue.serverTimestamp(),
      lastSyncSuccess: success,
      chunkCount: chunkCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  } catch (error) {
    console.error(`Error updating sync status for ${filePath}:`, error);
  }
}

/**
 * Parse markdown file with frontmatter
 * @param {string} content - Markdown content
 * @param {string} filePath - File path
 * @return {Object} Parsed document data
 */
function parseMarkdownFile(content, filePath) {
  try {
    // Parse frontmatter and content
    const {data: frontmatter, content: markdownContent} = matter(content);

    // Extract title
    const title = frontmatter.title ||
                 frontmatter.name ||
                 filePath.split("/").pop().replace(".md", "");

    // Extract description
    const description = frontmatter.description || frontmatter.excerpt || "";

    // Extract tags
    const tags = frontmatter.tags || [];

    // Extract code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const codeBlocks = [];
    let match;
    let index = 0;

    while ((match = codeBlockRegex.exec(markdownContent)) !== null) {
      codeBlocks.push({
        id: `code_${index}`,
        language: match[1] || "dart",
        content: match[2].trim(),
      });
      index++;
    }

    // Split by headings to get sections
    const sections = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings = [];

    while ((match = headingRegex.exec(markdownContent)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2],
        index: match.index,
      });
    }

    // Create sections based on headings
    for (let i = 0; i < headings.length; i++) {
      const start = headings[i].index;
      const end = i < headings.length - 1 ? headings[i + 1].index : markdownContent.length;
      const sectionContent = markdownContent.substring(start, end).trim();

      if (sectionContent.length > 50) {
        sections.push({
          heading: headings[i].text,
          level: headings[i].level,
          content: sectionContent,
        });
      }
    }

    return {
      title,
      description,
      tags,
      sections: sections.length > 0 ? sections : [{
        heading: title,
        level: 1,
        content: markdownContent,
      }],
      codeBlocks,
      frontmatter,
      rawContent: markdownContent,
    };
  } catch (error) {
    console.error(`Error parsing markdown for ${filePath}:`, error);
    throw error;
  }
}

/**
 * Process document and create chunks
 * @param {Object} fileData - Parsed file data
 * @param {string} filePath - File path
 * @param {string} commitSha - Commit SHA
 * @return {Promise<Array>} Array of document chunks
 */
async function processDocument(fileData, filePath, commitSha) {
  try {
    const chunks = [];
    const {title, description, tags, sections, codeBlocks} = fileData;

    const maxChunkSize = 1200;
    const overlapSize = 200;

    // Create GitHub URL
    const githubUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${filePath}`;

    let chunkIndex = 0;

    // Process each section
    for (const section of sections) {
      const sectionContent = section.content;
      const paragraphs = sectionContent.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

      let currentChunk = "";

      for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
          // Create chunk
          const chunkId = `${filePath.replace(/\//g, "_").replace(".md", "")}_chunk_${chunkIndex}`;
          const contentType = await classifyContent(currentChunk);

          chunks.push({
            id: chunkId,
            githubPath: filePath,
            url: githubUrl,
            title: title,
            content: currentChunk.trim(),
            contentType: contentType,
            chunkIndex: chunkIndex,
            lastUpdated: new Date().toISOString(),
            metadata: {
              title: title,
              section: section.heading,
              description: description,
              tags: tags,
              type: contentType,
              commitSha: commitSha,
              wordCount: currentChunk.trim().split(/\s+/).length,
            },
          });

          // Start new chunk with overlap
          const words = currentChunk.trim().split(/\s+/);
          const overlapWords = words.slice(-Math.floor(overlapSize / 5));
          currentChunk = overlapWords.join(" ") + " " + paragraph;
          chunkIndex++;
        } else {
          currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
        }
      }

      // Add final chunk if there's remaining content
      if (currentChunk.trim().length > 100) {
        const chunkId = `${filePath.replace(/\//g, "_").replace(".md", "")}_chunk_${chunkIndex}`;
        const contentType = await classifyContent(currentChunk);

        chunks.push({
          id: chunkId,
          githubPath: filePath,
          url: githubUrl,
          title: title,
          content: currentChunk.trim(),
          contentType: contentType,
          chunkIndex: chunkIndex,
          lastUpdated: new Date().toISOString(),
          metadata: {
            title: title,
            section: section.heading,
            description: description,
            tags: tags,
            type: contentType,
            commitSha: commitSha,
            wordCount: currentChunk.trim().split(/\s+/).length,
          },
        });
        chunkIndex++;
      }
    }

    // Add code blocks as separate chunks
    for (const codeBlock of codeBlocks) {
      const codeChunkId = `${filePath.replace(/\//g, "_").replace(".md", "")}_${codeBlock.id}`;
      chunks.push({
        id: codeChunkId,
        githubPath: filePath,
        url: githubUrl,
        title: `${title} - Code Example`,
        content: `Code example from ${title}:\n\n\`\`\`${codeBlock.language}\n${codeBlock.content}\n\`\`\``,
        contentType: "code",
        chunkIndex: -1,
        lastUpdated: new Date().toISOString(),
        metadata: {
          title: title,
          section: "Code Examples",
          description: description,
          tags: tags,
          type: "code",
          language: codeBlock.language,
          commitSha: commitSha,
          wordCount: codeBlock.content.split(/\s+/).length,
        },
      });
    }

    console.log(`Created ${chunks.length} chunks for ${title}`);
    return chunks;
  } catch (error) {
    console.error("Error processing document:", error);
    throw error;
  }
}

/**
 * Get or create sync progress tracker
 * @return {Promise<Object>} Progress data
 */
async function getSyncProgress() {
  try {
    const db = admin.firestore();
    const progressDoc = await db.collection("github_sync_metadata").doc("progress").get();

    if (progressDoc.exists) {
      return progressDoc.data();
    }

    const initialProgress = {
      repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
      branch: GITHUB_BRANCH,
      lastProcessedIndex: -1,
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      skippedFiles: 0,
      lastRunAt: null,
      isComplete: false,
    };

    await db.collection("github_sync_metadata").doc("progress").set(initialProgress);
    return initialProgress;
  } catch (error) {
    console.error("Error getting sync progress:", error);
    return {
      repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
      branch: GITHUB_BRANCH,
      lastProcessedIndex: -1,
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      skippedFiles: 0,
      lastRunAt: null,
      isComplete: false,
    };
  }
}

/**
 * Update sync progress
 * @param {Object} updates - Progress updates
 */
async function updateSyncProgress(updates) {
  try {
    const db = admin.firestore();
    await db.collection("github_sync_metadata").doc("progress").update({
      ...updates,
      lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating sync progress:", error);
  }
}

/**
 * Cloud Function to run GitHub sync
 */
exports.runGitHubSync = onRequest({
  cors: true,
  timeoutSeconds: 540,
  memory: "2GiB",
}, async (req, res) => {
  try {
    const {
      testMode = false,
      batchSize = 50,
      resetProgress = false,
    } = req.body || {};

    console.log(`Starting GitHub sync (testMode: ${testMode}, batchSize: ${batchSize})`);

    // Initialize Octokit with token
    const token = githubToken.value() || process.env.GITHUB_TOKEN;
    if (!token) {
      console.warn("GITHUB_TOKEN not set, API rate limits will apply");
    }

    const octokit = new Octokit({
      auth: token,
    });

    // Reset progress if requested
    if (resetProgress) {
      console.log("Resetting sync progress...");
      await updateSyncProgress({
        lastProcessedIndex: -1,
        completedFiles: 0,
        failedFiles: 0,
        skippedFiles: 0,
        isComplete: false,
      });
    }

    // Get current progress
    const progress = await getSyncProgress();
    console.log(`Current progress: ${progress.completedFiles}/${progress.totalFiles} files completed`);

    // Check if already complete
    if (progress.isComplete && !resetProgress) {
      console.log("Sync already complete. Use resetProgress: true to start over.");
      return res.json({
        success: true,
        message: "Sync already complete",
        progress: progress,
      });
    }

    // Fetch file tree from GitHub
    const githubFiles = await fetchGitHubFileTree(octokit);
    const totalFiles = githubFiles.length;

    // Update total files if changed
    if (progress.totalFiles !== totalFiles) {
      await updateSyncProgress({totalFiles: totalFiles});
    }

    // Calculate batch range
    const startIndex = progress.lastProcessedIndex + 1;
    const endIndex = Math.min(startIndex + batchSize, totalFiles);

    // For test mode, process smaller batch
    const filesToProcess = testMode ?
      githubFiles.slice(0, Math.min(3, totalFiles)) :
      githubFiles.slice(startIndex, endIndex);

    console.log(`Processing files ${startIndex + 1} to ${endIndex} of ${totalFiles}`);

    const results = {
      processed: 0,
      failed: 0,
      skipped: 0,
      totalChunks: 0,
      files: [],
      batchStartIndex: startIndex,
      batchEndIndex: endIndex,
    };

    // Process each file
    for (let i = 0; i < filesToProcess.length; i++) {
      const fileData = filesToProcess[i];
      const currentIndex = testMode ? i : startIndex + i;

      try {
        // Get latest commit SHA
        const commitSha = await getLatestCommitSha(octokit, fileData.path);

        if (!commitSha) {
          console.log(`⏭️  Skipping ${fileData.path} (no commit history)`);
          results.skipped++;
          continue;
        }

        // Check if file needs refresh
        const needsUpdate = await needsRefresh(fileData.path, commitSha);

        if (!needsUpdate) {
          console.log(`⏭️  Skipping ${fileData.path} (no changes since last sync)`);
          results.skipped++;
          results.files.push({
            path: fileData.path,
            status: "skipped",
            reason: "No changes since last sync",
          });

          // Update progress for skipped files
          if (!testMode) {
            await updateSyncProgress({
              lastProcessedIndex: currentIndex,
            });
          }

          continue;
        }

        console.log(`🔄 Processing ${fileData.path} (commit: ${commitSha.substring(0, 7)})`);

        // Download file content
        const content = await downloadFileContent(fileData.path);

        // Parse markdown
        const parsedData = parseMarkdownFile(content, fileData.path);

        // Process and chunk document
        const chunks = await processDocument(parsedData, fileData.path, commitSha);

        // Add chunks to vector index
        console.log("Adding to vector index...");
        try {
          const vectorDocs = chunks.map((chunk) => ({
            id: chunk.id,
            text: chunk.content,
            metadata: {
              githubPath: chunk.githubPath,
              url: chunk.url,
              title: chunk.title,
              contentType: chunk.contentType,
              lastUpdated: chunk.lastUpdated,
            },
          }));

          const vectorResult = await addDocumentsToIndex(vectorDocs);
          console.log(`✓ Added ${vectorDocs.length} documents to vector index: ${vectorResult.fileName}`);
        } catch (vectorError) {
          console.error("Error adding to vector index:", vectorError);
        }

        // Save chunks to Firestore
        const db = admin.firestore();
        for (const chunk of chunks) {
          await db.collection("document_chunks").doc(chunk.id).set(chunk);
        }

        // Update sync status
        await updateSyncStatus(fileData.path, commitSha, true, chunks.length);

        results.processed++;
        results.totalChunks += chunks.length;
        results.files.push({
          path: fileData.path,
          status: "success",
          chunks: chunks.length,
          title: parsedData.title,
          commitSha: commitSha.substring(0, 7),
        });

        console.log(`✓ Processed: ${parsedData.title} (${chunks.length} chunks)`);

        // Update progress after each successful file
        if (!testMode) {
          await updateSyncProgress({
            lastProcessedIndex: currentIndex,
            completedFiles: progress.completedFiles + results.processed,
          });
        }

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`✗ Failed to process ${fileData.path}:`, error.message);

        // Update sync status even for failed attempts
        await updateSyncStatus(fileData.path, fileData.sha, false, 0);

        results.failed++;
        results.files.push({
          path: fileData.path,
          status: "failed",
          error: error.message,
        });

        // Update progress even for failed files
        if (!testMode) {
          await updateSyncProgress({
            lastProcessedIndex: currentIndex,
            failedFiles: progress.failedFiles + results.failed,
          });
        }
      }
    }

    // Mark as complete if we've processed all files
    const finalProgress = await getSyncProgress();
    const isComplete = !testMode && (finalProgress.lastProcessedIndex >= totalFiles - 1);

    if (isComplete) {
      console.log("🎉 GitHub sync complete! All files processed.");
      await updateSyncProgress({isComplete: true});
    }

    res.json({
      success: true,
      message: isComplete ? "GitHub sync completed - all files processed" : "Batch completed",
      results: results,
      progress: {
        completed: finalProgress.completedFiles + results.processed,
        failed: finalProgress.failedFiles + results.failed,
        skipped: finalProgress.skippedFiles + results.skipped,
        total: totalFiles,
        percentage: Math.round(((finalProgress.completedFiles + results.processed) / totalFiles) * 100),
        isComplete: isComplete,
        nextBatchStart: isComplete ? null : finalProgress.lastProcessedIndex + 1,
      },
      testMode: testMode,
    });
  } catch (error) {
    console.error("GitHub sync error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
