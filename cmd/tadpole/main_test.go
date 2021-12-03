package main

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIndexerAddDoc(t *testing.T) {
	content := "上海市长江大桥"
	doc := Doc{
		Content: content,
		Title:   "",
	}
	indexer := NewIndexer()
	indexer.AddDoc(&doc)
	tokenizer := Tokenizer{}
	words := tokenizer.Tokenize(content)
	for _, word := range words {
		docs := indexer.QueryDocs(word)
		assert.Equal(t, 1, len(docs))
		assert.Equal(t, content, docs[0].Content)
	}
}

func TestParseFileContent(t *testing.T) {
	orgParser := OrgParser{}
	docs, err := orgParser.ParseFileContent("* This is title\nContent line 1\nContent line 2\n* Another title", "/tmp/a.org")
	if err != nil {
		panic(err)
	}
	assert.Equal(t, 2, len(docs))
	assert.Equal(t, "* This is title", docs[0].Title)
	assert.Equal(t, "Content line 1\nContent line 2", docs[0].Content)
}
