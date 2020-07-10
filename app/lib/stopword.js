const fs = require('fs');

class Stopword {
  /**
   * @param {string} path - 停用词列表的文件路径
   */
  constructor(path) {
    const content = fs.readFileSync(path, 'utf-8');
    this.stopwords = content.split('\n').map(w => w.trim()).filter(w => w !== '');
  }

  /**
   * 检测一个词是否为停用词。
   * @param {string} word - 待检测的词
   */
  test(word) {
    return this.stopwords.includes(word);
  }
}

module.exports = Stopword;
