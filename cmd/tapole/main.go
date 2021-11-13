package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"strings"
	"sync"

	"github.com/yanyiwu/gojieba"
)

// Doc 表示 .org 文件中的一条被简单解析过的条目。
type Doc struct {
	BeginLineNum int
	Content      string
	FilePath     string
	Title        string
}

type Indexer struct {
	WordToDocs map[string][]Doc
}

func (indexer *Indexer) AddDoc(doc *Doc) {
	indexer.addText(doc, doc.Content)
	indexer.addText(doc, doc.Title)
}

// QueryDocs 返回与输入 query 相关的文档的副本。
func (indexer *Indexer) QueryDocs(query string) []Doc {
	relatedDocs := map[string]*Doc{}
	words := (&Tokenizer{}).Tokenize(query)
	for _, word := range words {
		_docs := indexer.WordToDocs[word]
		for _, _doc := range _docs {
			relatedDocs[_doc.Title] = &_doc
		}
	}
	docs := []Doc{}
	for _, doc := range relatedDocs {
		docs = append(docs, *doc)
	}
	return docs
}

// 私有方法位于公开方法之下

func (indexer *Indexer) addText(doc *Doc, text string) {
	words := (&Tokenizer{}).Tokenize(text)
	for _, word := range words {
		_, found := indexer.WordToDocs[word]
		if !found {
			indexer.WordToDocs[word] = []Doc{}
		}

		docs := indexer.WordToDocs[word]
		found = false
		for _, _doc := range docs {
			if _doc.Title == doc.Title {
				found = true
				break
			}
		}
		if !found {
			indexer.WordToDocs[word] = append(docs, *doc)
		}
	}
}

// 构造函数位于所有方法之下

func NewIndexer() *Indexer {
	return &Indexer{
		WordToDocs: map[string][]Doc{},
	}
}

type OrgParser struct{}

// ParseFile 解析 Org 格式的文件内容，得到一系列文档。
func (*OrgParser) ParseFileContent(fileContent string, path string) ([]Doc, error) {
	lines := strings.Split(fileContent, "\n")
	docs := make([]Doc, 0)
	i := 0
	for i < len(lines) {
		line := lines[i]
		if line[0] == '*' {
			// 在这里读取一个完整的文档对象。
			// 直到下一个以星号开始的行为止，都是这个文档的内容。
			beginLineNum := i + 1
			title := line
			i += 1
			contentLines := make([]string, 0)
			for i < len(lines) {
				line := lines[i]
				if len(line) == 0 {
					i += 1
					continue
				}
				if line[0] != '*' {
					contentLines = append(contentLines, line)
					i += 1
				} else {
					break
				}
			}
			docContent := strings.Join(contentLines, "\n")
			docs = append(docs, Doc{
				BeginLineNum: beginLineNum,
				Content:      docContent,
				FilePath:     path,
				Title:        title,
			})
		} else {
			panic(fmt.Errorf("无法处理第%d行：%s", i+1, line))
		}
	}
	return docs, nil
}

type Tokenizer struct{}

var (
	jiebaEngine *gojieba.Jieba
	once        sync.Once
)

func (*Tokenizer) Tokenize(content string) []string {
	once.Do(func() {
		jiebaEngine = gojieba.NewJieba() // TODO: 需要在进程退出时调用 Free 方法。
	})
	return jiebaEngine.Cut(content, true)
}

// listDirectoryFile 返回一个目录下除了.和..之外的所有文件的绝对路径。
func listDirectoryFile(dir string) ([]string, error) {
	result := []string{}
	fileInfos, err := ioutil.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	for _, fileInfo := range fileInfos {
		basename := fileInfo.Name()
		if basename == "." || basename == ".." {
			continue
		}
		absolutePath := dir + "/" + basename
		if fileInfo.IsDir() {
			files, err := listDirectoryFile(absolutePath)
			if err != nil {
				return nil, err
			}
			result = append(result, files...)
		} else {
			result = append(result, absolutePath)
		}
	}
	return result, nil
}

func main() {
	files, err := listDirectoryFile("/Users/liutos/Projects/my_note/faq")
	if err != nil {
		log.Fatal(err)
		return
	}

	indexer := NewIndexer()
	for _, file := range files {
		data, err := ioutil.ReadFile(file)
		if err != nil {
			log.Fatal(err)
			return
		}

		content := string(data)
		docs, err := (&OrgParser{}).ParseFileContent(content, file)
		if err != nil {
			log.Fatal(err)
			return
		}
		log.Printf("解析了文件%s\n", file)

		for _, doc := range docs {
			indexer.AddDoc(&doc)
			log.Printf("将文档%s加入到索引中\n", doc.Title)
		}
	}
}
