const INVERTED_INDEX = Symbol('Application#inverted_index');

module.exports = {
  get invertedIndex() {
    return this[INVERTED_INDEX];
  },
  set invertedIndex(invertedIndex) {
    this[INVERTED_INDEX] = invertedIndex;
    console.log('全局倒排索引设置完毕。');
  }
};