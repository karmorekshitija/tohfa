fetch('http://localhost:5173/buyer/saved-reels.html')
.then(res => res.text().then(html => {
  console.log('HTML Length:', html.length);
  // Print everything in the <head> and the opening <body> tag
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/);
  if (headMatch) {
    console.log('--- HEAD ---');
    console.log(headMatch[1].trim());
  }
  const bodyMatch = html.match(/<body[\s\S]*?>/);
  if (bodyMatch) {
    console.log('--- BODY TAG ---');
    console.log(bodyMatch[0]);
  }
}))
.catch(err => {
  console.error('Error:', err.message);
});
