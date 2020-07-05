const InvertedIndex = require('../lib/inverted-index');

module.exports = {
  schedule: {
    cron: '0 0 13 * * *',
    type: 'worker'
  },
  async task(ctx) {
    ctx.logger.info('开始重新加载问题集。');
    const faqs = await ctx.service.faq.loadFaqs();
    const invertedIndex = new InvertedIndex();
    for (const faq of faqs) {
      invertedIndex.update(faq);
    }
    ctx.app.invertedIndex = invertedIndex;
    ctx.logger.info('重新加载完毕。');
  }
};