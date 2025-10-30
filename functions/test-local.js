#!/usr/bin/env node

// Test if functions can be imported and have correct structure
console.log('🧪 Testing function imports and structure...\n');

function testImport(moduleName, functionName) {
  try {
    console.log(`Testing ${moduleName}.js -> ${functionName}...`);
    const module = require(`./${moduleName}`);

    if (module[functionName]) {
      console.log(`✅ ${functionName} found in ${moduleName}.js`);
      console.log(`   Type: ${typeof module[functionName]}`);
      if (module[functionName].handler) {
        console.log(`   Has handler: Yes`);
      }
    } else {
      console.log(`❌ ${functionName} NOT found in ${moduleName}.js`);
      console.log(`   Available exports:`, Object.keys(module));
    }
    console.log('---');
  } catch (error) {
    console.log(`❌ Error importing ${moduleName}.js: ${error.message}`);
    console.log('---');
  }
}

// Test all function imports
testImport('generateAnswer', 'generateAnswer');
testImport('generateAnswer', 'getHistory');
testImport('runCrawler', 'runCrawler');
testImport('mockRAG', 'mockRAG');
testImport('mockRAG', 'mockHistory');
testImport('simpleTest', 'simpleTest');

// Test helper modules
console.log('\n🛠️ Testing helper modules...\n');

try {
  const rag = require('./rag');
  console.log('✅ rag.js imports successfully');
  console.log(`   Available functions: ${Object.keys(rag).join(', ')}`);
} catch (error) {
  console.log(`❌ Error importing rag.js: ${error.message}`);
}

try {
  const llm = require('./llm');
  console.log('✅ llm.js imports successfully');
  console.log(`   Available functions: ${Object.keys(llm).join(', ')}`);
} catch (error) {
  console.log(`❌ Error importing llm.js: ${error.message}`);
}

console.log('\n🏁 Import tests completed!');