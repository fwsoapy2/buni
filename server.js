const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

app.use(express.static(publicDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/calculator', (req, res) => {
  res.sendFile(path.join(publicDir, 'calculator', 'index.html'));
});

app.get('/faq', (req, res) => {
  res.sendFile(path.join(publicDir, 'faq', 'index.html'));
});

app.get('/discord', (req, res) => {
  res.sendFile(path.join(publicDir, 'discord', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Buni Boosting running on port ${PORT}`);
});
