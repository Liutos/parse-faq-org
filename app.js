const InvertedIndex = require('./app/lib/inverted-index');
const Lexer = require('./app/lib/lexer');
const Stopword = require('./app/lib/stopword');

const path = require('path');

class AppBootHook {
  constructor(app) {
    this.app = app;
  }

  async didReady() {
    // 调用service提供的方法将FAQ加载到内存中。
    const ctx = await this.app.createAnonymousContext();
    const faqs = await ctx.service.faq.loadFaqs();
    const stopwordPath = path.resolve(__dirname, './app/lib/cn_stopwords.txt');
    const stopword = new Stopword(stopwordPath);
    const lexer = new Lexer(stopword);
    const invertedIndex = new InvertedIndex(lexer);
    for (const faq of faqs) {
      invertedIndex.update(faq);
    }
    this.app.invertedIndex = invertedIndex;
  }
}

module.exports = AppBootHook;