package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/go-ego/gse"
	"github.com/go-redis/redis/v8"
)

// Doc 表示 .org 文件中的一条被简单解析过的条目。
type Doc struct {
	BeginLineNum int
	Content      string
	FilePath     string
	Title        string
}

type ITokenizer interface {
	Tokenize(content string) ([]string, error)
}

type Indexer struct {
	WordToDocs map[string][]Doc
	tokenizer  ITokenizer
}

func (indexer *Indexer) AddDoc(doc *Doc) {
	indexer.addText(doc, doc.Content)
	indexer.addText(doc, doc.Title)
}

// QueryDocs 返回与输入 query 相关的文档的副本。
func (indexer *Indexer) QueryDocs(query string) []Doc {
	relatedDocs := map[string]Doc{}
	words, _ := indexer.tokenizer.Tokenize(query)
	for _, word := range words {
		_docs := indexer.WordToDocs[word]
		for _, _doc := range _docs {
			relatedDocs[_doc.Title] = _doc
		}
	}
	docs := []Doc{}
	for _, doc := range relatedDocs {
		docs = append(docs, doc)
	}
	return docs
}

// 私有方法位于公开方法之下

func (indexer *Indexer) addText(doc *Doc, text string) {
	// TODO: 补充对错误的处理。
	words, _ := indexer.tokenizer.Tokenize(text)
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
		tokenizer:  &PullWordTokenizer{},
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
	dictPath string
	once     sync.Once
	rdb      *redis.Client
	seg      gse.Segmenter
)

func (*Tokenizer) Tokenize(content string) []string {
	once.Do(func() {
		err := seg.LoadDict(dictPath)
		if err != nil {
			panic(err)
		}
	})
	return seg.Cut(content, true)
}

type PullWordTokenizer struct{}

type pullWordToken struct {
	T string `json:"t"`
}

func (*PullWordTokenizer) Tokenize(content string) ([]string, error) {
	once.Do(func() {
		rdb = redis.NewClient(&redis.Options{
			Addr:     "localhost:6379",
			DB:       0,
			Password: "",
		})
	})
	var words []string
	ctx := context.Background()
	// TODO: 补充对下文中各种错误的处理。
	cached, _ := rdb.Get(ctx, content).Result()
	if cached != "" {
		err := json.Unmarshal([]byte(cached), &words)
		if err == nil {
			return words, nil
		}
	}

	urlText := fmt.Sprintf("http://api.pullword.com/get.php?source=%s&param1=0&param2=0&json=1", url.QueryEscape(content))
	req, err := http.NewRequest("GET", urlText, nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var tokens []pullWordToken
	json.Unmarshal(body, &tokens)
	for _, token := range tokens {
		words = append(words, token.T)
	}
	bs, _ := json.Marshal(words)
	_ = rdb.Set(ctx, content, string(bs), 0).Err()
	return words, nil
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

type QueryResult struct {
	Answer          string `json:"answer"`
	Path            string `json:"path"`
	Question        string `json:"question"`
	QuestionLineNum int    `json:"questionLineNum"`
}

func main() {
	var dir string
	flag.StringVar(&dir, "d", "", "笔记文件所在的目录")
	flag.StringVar(&dictPath, "i", "", "词典文件路径")
	flag.Parse()
	if dir == "" {
		log.Fatal("选项 -d 不能为空")
		return
	}
	if dictPath == "" {
		log.Fatal("选项 -i 不能为空")
		return
	}

	var indexer *Indexer

	// TODO: 需要获取一个 indexer 变量的写锁才行。
	log.Printf("开始解析%s下的文件", dir)
	files, err := listDirectoryFile(dir)
	if err != nil {
		log.Fatal(err)
		return
	}

	newIndexer := NewIndexer()
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
			newIndexer.AddDoc(&doc)
			log.Printf("将文档%s加入到索引中\n", doc.Title)
		}
	}
	indexer = newIndexer

	r := gin.Default()
	r.GET("/faq/query", func(c *gin.Context) {
		faqs := []*QueryResult{}
		docs := indexer.QueryDocs(c.Query("query"))
		for _, doc := range docs {
			faqs = append(faqs, &QueryResult{
				Answer:          doc.Content,
				Path:            doc.FilePath,
				Question:        doc.Title,
				QuestionLineNum: doc.BeginLineNum,
			})
		}
		data := map[string]interface{}{
			"data": map[string]interface{}{
				"faqs": faqs,
			},
		}
		c.JSON(200, data)
	})
	r.Run()
}
