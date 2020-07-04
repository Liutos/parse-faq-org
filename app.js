const InvertedIndex = require('./app/lib/inverted-index');

class AppBootHook {
  constructor(app) {
    this.app = app;
  }

  async didReady() {
    // 调用service提供的方法将FAQ加载到内存中。
    const ctx = await this.app.createAnonymousContext();
    const faqs = await ctx.service.faq.loadFaqs();
    const invertedIndex = new InvertedIndex();
    for (const faq of faqs) {
      invertedIndex.update(faq);
    }
    this.app.invertedIndex = invertedIndex;
  }
}

module.exports = AppBootHook;