/**
 * DOCX File Handler (OCP)
 * Reads and writes Word .docx documents
 */

const fs = require('fs');
const mammoth = require('mammoth');

module.exports = {
  ext: '.docx',
  name: 'Word Documents',

  async read(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return {
      content: result.value,
      metadata: {},
      cover: null
    };
  },

  async write(filePath, content) {
    const { Document, Packer, Paragraph, TextRun } = require('docx');
    
    const paragraphs = content.split('\n').map(line => {
      return new Paragraph({
        children: [new TextRun({ text: line })],
      });
    });
    
    const doc = new Document({
      sections: [{
        children: paragraphs,
      }],
    });
    
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);
  }
};
