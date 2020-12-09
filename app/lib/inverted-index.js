/**
 * 实现倒排索引
 */
'use strict';

const FAQS = Symbol('InvertedIndex#faqs');
const WORDS = Symbol('InvertedIndex#words');
const WORD_FAQ_MAPPING = Symbol('InvertedIndex#word_faq_mapping');

class InvertedIndex {
  /**
   * @param {Object} lexer - 分词器
   */
  constructor(lexer) {
    this.faqs = [];
    this.lexer = lexer;
    this.words = [];
    this.wordFaqMappings = [];
  }

  /**
   * @returns {[]}
   */
  get faqs() {
    return this[FAQS];
  }

  /**
   * @returns {string[]}
   */
  get words() {
    return this[WORDS];
  }

  get wordFaqMappings() {
    return this[WORD_FAQ_MAPPING];
  }

  set faqs(newValue) {
    this[FAQS] = newValue;
  }

  set words(newValue) {
    this[WORDS] = newValue;
  }

  set wordFaqMappings(newValue) {
    this[WORD_FAQ_MAPPING] = newValue;
  }

  async search(query) {
    const faqs = this.faqs;
    const lexer = this.lexer;
    const wordFaqMappings = this.wordFaqMappings;
    // 先对查询的内容进行分词
    const words = lexer.tokenize(query);
    console.log('分词结果为', words);
    // 根据分词结果找出所有待搜索的词
    const targetWords = this._generalizeWords(words);
    // 再用每一个词分别找出能够在answer和question字段中命中的文档
    const results = new Map();
    const fields = ['answer', 'path', 'question'];
    for (const field of fields) {
      for (const word of targetWords) {
        const wordId = this._findOrAllocateWordId(word);
        console.log(`“${word}”的ID为${wordId}`);
        const mappings = wordFaqMappings.filter(m => {
          return m.field === field
            && m.wordId === wordId;
        });
        console.log(`共${mappings.length}份文档的${field}字段含有ID为${wordId}的词素“${word}”。`);
        mappings.forEach(tuple => {
          // 将每一份文档都记录到results中，并同时更新它们的“评分”。
          const { faqId } = tuple;
          if (results.has(faqId)) {
            const score = results.get(faqId);
            results.set(faqId, score + 1);
          } else {
            results.set(faqId, 1);
          }
        });
      }
    }
    const sortedDocIds = Array.from(results.entries()).sort((a, b) => {
      return b[1] - a[1];
    });
    console.log('sortedDocIds', sortedDocIds);
    return sortedDocIds.map(t => {
      return faqs[t[0]];
    });
  }

  /**
   * 将问题加入到已有的倒排索引数据中去
   * @param {Object} faq - 问题实体对象
   * @param {string} faq.answer - 问题的解决方案
   * @param {string} faq.question - 问题的描述
   */
  update(faq) {
    const lexer = this.lexer;
    const faqId = this._findOrAllocateFaqId(faq);
    const fields = ['answer', 'path', 'question'];
    for (const field of fields) {
      const content = faq[field];
      const words = lexer.tokenize(content);
      for (const word of words) {
        const wordId = this._findOrAllocateWordId(word);
        this._saveMapping(field, wordId, faqId);
      }
    }
  }

  /**
   * @param {Object} faq - 需要查询ID的问题实体对象
   * @param {string} faq.question - 问题描述。必须是全局唯一的。
   */
  _findOrAllocateFaqId(faq) {
    const faqs = this.faqs;
    const index = faqs.findIndex(({ question }) => question === faq.question);
    if (index !== -1) {
      return index;
    }
    faqs.push(faq);
    return faqs.length - 1;
  }

  /**
   * @param {string} word - 需要查询ID的词素。
   */
  _findOrAllocateWordId(word) {
    const words = this.words;
    const index = words.findIndex(w => w === word);
    if (index !== -1) {
      return index;
    }
    words.push(word);
    return words.length - 1;
  }

  /**
   * 返回泛化后的分词结果
   * @param {string[]} words - 查询内容的原始分词结果
   */
  _generalizeWords(words) {
    const result = [];
    this.words.forEach(w => {
      if (words.includes(w)) {
        result.push(w);
      } else if (words.find(word => w.startsWith(word))) {
        // 将以查询内容为前缀的预分词结果也作为稍后匹配文档时的候选项
        // 解决搜索“复制”时没有将分词结果为“复制到”的FAQ搜出来的问题。
        result.push(w);
      }
    });
    return result;
  }

  /**
   * @param {string} field - 字段名
   * @param {number} wordId - 词素的ID
   * @param {number} faqId - 问题的ID
   */
  _saveMapping(field, wordId, faqId) {
    const wordFaqMappings = this.wordFaqMappings;
    const mapping = wordFaqMappings.find(m => {
      return m.field === field
        && m.wordId === wordId
        && m.faqId === faqId;
    });
    if (!mapping) {
      wordFaqMappings.push({
        faqId,
        field,
        wordId
      });
    }
  }
}

module.exports = InvertedIndex;
