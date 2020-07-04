module.exports = app => {
  const { router, controller } = app;
  router.get('/faq/query', controller.faq.query);
};