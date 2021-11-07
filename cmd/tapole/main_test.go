package main

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

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
