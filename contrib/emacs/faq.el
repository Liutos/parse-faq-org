;;; 调用ElasticSearch/parse-faq-org查询笔记
(require 'request)

(defun faq (query)
  "向ElasticSearch查询QUERY匹配的笔记"
  (let ((response))
    (request
     "http://localhost:9200/faq/_search"
     :data (encode-coding-string
            (json-encode
             (list
              (cons "query" (list
                             (cons "multi_match" (list
                                                  (cons "fields" (list "answer" "question"))
                                                  (cons "query" query)))))))
            'utf-8)
     :headers '(("Content-Type" . "application/json"))
     :parser 'buffer-string
     :success (cl-function
               (lambda (&key data &allow-other-keys)
                 (setq data (decode-coding-string data 'utf-8))
                 (setq response (json-read-from-string data))))
     :sync t)
    response))

(defun lt--query-parse-faq-org (query)
  "调用parse-faq-org服务的接口，查询与关键词QUERY匹配的内容。"
  (let ((response)
        (url (url-encode-url
              (format "http://localhost:9020/faq/query?query=%s" query))))
    (message "待请求的url为%s" url)
    (request
     url
     :parser 'buffer-string
     :success (cl-function
               (lambda (&key data &allow-other-keys)
                 (setq data (decode-coding-string data 'utf-8))
                 (setq response (json-read-from-string data))))
     :sync t)
    response))

;;; 转换接口的响应结果

(defun lt--convert-to-candidates (response)
  "将parse-faq-org服务的原始响应结果转换为可供helm使用的候选项。"
  (let ((faqs (cdr (assoc 'faqs
                          (cdr (assoc 'data response))))))
    (mapcar (lambda (faq)
              (cons (cdr (assoc 'question faq))
                    (cdr (assoc 'answer faq))))
            faqs)))

(defun make-faq-candidates (response)
  "将查询ElasticSearch的结果构造为helm可以识别的candidates格式"
  (let ((hits (cdr (assoc 'hits (cdr (assoc 'hits response))))))
    (mapcar (lambda (doc)
              (let ((_source (cdr (assoc '_source doc))))
                (cons (cdr (assoc 'question _source))
                      ;; (cdr (assoc 'answer (assoc '_source doc)))
                      (cdr (assoc '_id doc)))))
            hits)))

(defvar faq-query nil
  "存储用户的查询关键词的变量。")

(defun faq-candidates ()
  ;; (make-faq-candidates (faq faq-query))
  (lt--convert-to-candidates
   (lt--query-parse-faq-org faq-query)))

;;; 创建新的buffer并将ElasticSearch的内容展示在其中
(defun show-faq (text)
  ;; 创建一个buffer，显示它并选中这个窗口
  (let ((buffer (get-buffer-create "*FAQ*")))
    (let ((window (display-buffer buffer)))
      (select-window window)
      ;; 用新的内容覆盖原来的内容
      (setq inhibit-read-only t)
      (org-mode)
      (erase-buffer)
      (insert text)
      (read-only-mode))))

;;; 定义用于helm的source

(setq faq-helm-sources
      `((name . "FAQ at Emacs")
        (candidates . faq-candidates)
        (action . (lambda (candidate)
                    (let (response
                          (url (format "http://localhost:9200/faq/_doc/%s" candidate)))
                      (message "url is %s" url)
                      (request
                       url
                       :parser 'buffer-string
                       :success (cl-function
                                 (lambda (&key data &allow-other-keys)
                                   (setq data (decode-coding-string data 'utf-8))
                                   (setq response (json-read-from-string data))))
                       :sync t)
                      ;; 从文档中提取出问题和答案，拼装成原本在.org文件中的模样
                      (let ((answer (cdr (assoc 'answer (assoc '_source response))))
                            (question (cdr (assoc 'question (assoc '_source response)))))
                        (show-faq
                         (concat question "\n" answer))))))))

(setq faq-helm-sources
      (list
       `((name . "parse-faq-org的匹配结果")
         (candidates . faq-candidates)
         (action . (lambda (candidate)
                     (show-faq candidate))))))

(defun lt-ask ()
  "交互式地从minibuffer中读取笔记的关键词并展示选项"
  (interactive)
  (let ((content (read-from-minibuffer "笔记关键词：")))
    (setq faq-query content)
    (helm :sources faq-helm-sources)))
