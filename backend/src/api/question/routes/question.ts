export default {
  routes: [
    {
      method: 'PATCH',
      path: '/questionnaires/:id/questions',
      handler: 'api::question.question.add',
      config: { policies: [] },
    },
  ],
};
