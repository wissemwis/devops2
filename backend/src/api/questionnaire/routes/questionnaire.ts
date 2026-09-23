export default {
  routes: [
    {
      method: 'POST',
      path: '/questionnaires',
      handler: 'api::questionnaire.questionnaire.create',
      config: { policies: [] },
    },
  ],
};
