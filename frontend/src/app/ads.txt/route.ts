export async function GET() {
  const content = `# PDFlow ads.txt
# Add your ad network entries here
# google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
