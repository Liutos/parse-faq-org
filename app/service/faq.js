const Service = require('egg').Service;

const fs = require('fs');

class FaqService extends Service {
  /**
   * 加载存放FAQ的文件并返回解析后的列表
   */
  async loadFaqs() {
    let faqs = [];
    const dir = '/Users/liutos/Projects/my_note/faq/';
    const basenames = fs.readdirSync(dir);
    for (const basename of basenames) {
      const path = dir + basename;
      const faqSlice = await this._loadFaqFile(path);
      faqs = faqs.concat(faqSlice);
    }
    return faqs;
  }

  /**
   * @param {string} query - 待查找的内容的关键词
   */
  async searchByQuery(query) {
    const { app: { invertedIndex } } = this;
    const faqs = invertedIndex.search(query);
    return faqs;
  }

  async _loadFaqFile(path) {
    const content = fs.readFileSync(path).toString('utf-8');
    const lines = content.split('\n');
    const faqs = [];
    let answer = [];
    let lineNum = 0;
    let mode;
    let question;
    let questionLineNum;
    for (const line of lines) {
      lineNum += 1;
      if (line.startsWith('*')) {
        if (mode === 'answer') {
          // 在遇到星号的时候模式已经处于answer中，说明在此之前还有未处理的QA
          faqs.push({
            answer: answer.join('\n'),
            path,
            question,
            questionLineNum
          });
          answer = [];
          question = null;
        }
        mode = 'question';
      } else {
        mode = 'answer';
      }
      if (mode === 'answer') {
        answer.push(line);
      } else {
        question = line;
        questionLineNum = lineNum;
      }
    }
    if (question) {
      faqs.push({
        answer: answer.join('\n'),
        path,
        question,
        questionLineNum
      });
    }
    return faqs;
  }
}

module.exports = FaqService;