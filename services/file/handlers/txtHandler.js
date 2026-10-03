/**
 * TXT File Handler (OCP)
 * Reads and writes plain text files
 */

const fs = require('fs');

module.exports = {
  ext: '.txt',
  name: 'Text Files',

  async read(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      content,
      metadata: {},
      cover: null
    };
  },

  async write(filePath, content) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
};
