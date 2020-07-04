const Controller = require('egg').Controller;

class HomeController extends Controller {
  async query() {
    // 对输入分词然后匹配到倒排索引中
    const { query } = this.ctx.query;
    const { service } = this.ctx;
    if (!query) {
      throw new Error('缺少query参数。');
    }

    const faqs = await service.faq.searchByQuery(query);

    this.ctx.body = {
      data: {
        faqs
      }
    };
  }
}

module.exports = HomeController;