export default {
  routes: [
    {
      method: 'POST',
      path: '/questionnaires',
      handler: 'api::questionnaire.questionnaire.create',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/questionnaires/:id/publish',
      handler: 'api::questionnaire.questionnaire.publish',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/questionnaires/:id/close',
      handler: 'api::questionnaire.questionnaire.close',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/mes-questionnaires',
      handler: 'api::questionnaire.questionnaire.findMine',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/mes-questionnaires/:id',
      handler: 'api::questionnaire.questionnaire.findOneMine',
      config: { policies: [] },
    },
  ],
};
