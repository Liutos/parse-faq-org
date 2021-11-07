package main

import (
	"fmt"
	"strings"
)

// Doc 表示 .org 文件中的一条被简单解析过的条目。
type Doc struct {
	BeginLineNum int
	Content      string
	FilePath     string
	Title        string
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

func main() {
	fmt.Println("Hello, world!")
}
