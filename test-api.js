// Simple Node.js test script
// Run with: node test-api.js

const testMessage = 'credit card #5233 charged EGP 150.00 at Starbucks';

fetch('http://localhost:3000/api/process-transaction', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ message: testMessage }),
})
  .then(response => response.json())
  .then(data => {
    console.log('✅ Success!');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure your Next.js dev server is running:');
    console.log('   npm run dev');
  });
