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
                    ;; 为了可以让action同时取到问题的描述和解答部分，这里必须要将这两者都放入candidate中。
                    (list (cdr (assoc 'answer faq))
                          (cdr (assoc 'question faq)))))
            faqs)))

(defvar faq-query nil
  "存储用户的查询关键词的变量。")

(defun faq-candidates ()
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
      (read-only-mode)
      ;; 在这个buffer中设置按键q为退出
      (use-local-map (copy-keymap org-mode-map))
      (local-set-key "\C-q" (lambda ()
                              (interactive)
                              (kill-buffer (current-buffer)))))))

(defun lt-ask ()
  "交互式地从minibuffer中读取笔记的关键词并展示选项"
  (interactive)
  (let ((content (read-from-minibuffer "笔记关键词：")))
    (setq faq-query content)
    (helm :sources faq-helm-sources)))

(provide 'parse-faq-org)
