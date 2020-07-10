const nodejieba = require('nodejieba');

const PUNCTUATION_PATTERN = /^[.,\/#!$%\^&\*;:{}=\-_`~()\[\]]+$/;

class Lexer {
  /**
   * @param {Object} stopword - 停用词检测器
   */
  constructor(stopword) {
    this.stopword = stopword;
  }

  /**
   * 将原句切割为一个个词素。移除其中的空白字符、停用词后再返回。
   * @param {string} sentence - 待分词的句子
   */
  tokenize(sentence) {
    const words = nodejieba.cut(sentence, true);
    return words.map(word => word.trim())
      .filter(word => word !== '')
      .filter(word => !PUNCTUATION_PATTERN.test(word))
      .filter(word => !this.stopword.test(word));
  }
}

module.exports = Lexer;
