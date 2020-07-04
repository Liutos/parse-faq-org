const Lexer = require('./lib/lexer');

const fs = require('fs');

const INVERTED_INDEXES = [];
const QAS = [];
const WORDS = [];

let lexer = null;

/**
 * 为QA分配一个ID
 * @param {Object} qa - 问题及其解答
 */
function allocateQaId(qa) {
  const { question } = qa;
  const index = QAS.findIndex(qa => qa.question === question);
  if (index !== -1) {
    return index;
  }
  QAS.push(qa);
  return QAS.length - 1;
}

function findOrAllocateWordId(word) {
  const index = WORDS.findIndex(w => w === word);
  if (index !== -1) {
    return index;
  }
  WORDS.push(word);
  return WORDS.length - 1;
}

function parseFaqOrg(path) {
  const content = fs.readFileSync(path).toString('utf-8');
  const lines = content.split('\n');
  const qas = [];
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
        qas.push({
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
    qas.push({
      answer: answer.join('\n'),
      question
    });
  }
  // console.log(JSON.stringify(qas, null, 2));
  return qas;
}

function saveInvertedIndex(field, wordId, docId) {
  const tuple = INVERTED_INDEXES.find(ii => {
    return ii.field === field && ii.wordId === wordId && ii.docId === docId;
  });
  if (!tuple) {
    INVERTED_INDEXES.push({
      docId,
      field,
      wordId
    });
  }
}

/**
 * 根据待搜索的内容采用全文索引的方式搜索匹配的FAQ
 * @param {string} query - 搜索的关键字
 */
function searchFaq(query) {
  // 先对查询的内容进行分词
  const words = lexer.tokenize(query);
  console.log('分词结果为', words);
  // 再用每一个词分别找出能够在answer和question字段中命中的文档
  const results = new Map();
  const fields = ['answer', 'question'];
  for (const field of fields) {
    for (const word of words) {
      const wordId = findOrAllocateWordId(word);
      console.log(`“${word}”的ID为${wordId}`);
      const tuples = searchInvertedIndex(field, wordId);
      console.log(`共${tuples.length}份文档的${field}字段含有ID为${wordId}的词素“${word}”。`);
      tuples.forEach(tuple => {
        // 将每一份文档都记录到results中，并同时更新它们的“评分”。
        const { docId } = tuple;
        if (results.has(docId)) {
          const score = results.get(docId);
          results.set(docId, score + 1);
        } else {
          results.set(docId, 1);
        }
      });
    }
  }
  console.log(`查询内容“${query}”命中的文档有：`);
  const sortedDocIds = Array.from(results.entries()).sort((a, b) => {
    return b[1] - a[1];
  });
  sortedDocIds.slice(0, 5).forEach(tuple => {
    const docId = tuple[0];
    console.log(`- ID为${docId}的文档${QAS[docId].question}`);
  });
}

function searchInvertedIndex(field, wordId) {
  const tuples = INVERTED_INDEXES.filter(ii => {
    return ii.field === field && ii.wordId === wordId;
  });
  return tuples;
}

/**
 * 重建faq索引并写入全量的笔记数据
 */
async function main() {
  lexer = new Lexer();

  console.log(new Date().toLocaleString());
  const dir = '/Users/liutos/Projects/my_note/faq/';
  const basenames = fs.readdirSync(dir);
  for (const basename of basenames) {
    const path = dir + basename;
    const type = basename.match(/(.*)\.org/)[1];
    const qas = parseFaqOrg(path);
    for (const qa of qas) {
      // 为问题分配一个ID
      const docId = allocateQaId(qa);
      // 对问题的answer和question字段分别分词，并构建倒排索引。
      const fields = ['answer', 'question'];
      for (const field of fields) {
        const content = qa[field];
        const words = lexer.tokenize(content);
        for (const word of words) {
          // 为一个词分配一个ID
          const wordId = findOrAllocateWordId(word);
          // 将field、wordId、docId的三元组存储起来
          saveInvertedIndex(field, wordId, docId);
        }
      }
    }
    console.log(`文件${path}处理完毕`);
  }
  console.log(new Date().toLocaleString());

  // 尝试基于倒排索引搜索笔记
  searchFaq('git 乱码');
}

main();
