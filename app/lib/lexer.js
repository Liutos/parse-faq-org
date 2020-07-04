const nodejieba = require('nodejieba');

const PUNCTUATION_PATTERN = /^[.,\/#!$%\^&\*;:{}=\-_`~()\[\]]+$/;

class Lexer {
  /**
   * 将原句切割为一个个词素。移除其中的空白字符后再返回。
   * @param {string} sentence - 待分词的句子
   */
  static tokenize(sentence) {
    const words = nodejieba.cut(sentence, true);
    return words.map(word => word.trim())
      .filter(word => word !== '')
      .filter(word => !PUNCTUATION_PATTERN.test(word));
  }
}

module.exports = Lexer;
