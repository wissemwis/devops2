export default function QuestionnaireIntrouvable() {
  return (
    <>
      <h1 className="mt-ligne text-[28px] font-bold leading-[64px] tracking-[-0.02em]">
        Questionnaire introuvable
      </h1>
      <p className="mt-ligne leading-[32px]">
        Ce questionnaire n&apos;existe pas ou ne vous appartient pas.
      </p>
      <p className="leading-[32px]">
        <a
          href="/questionnaires"
          className="entoure text-encre underline underline-offset-4 transition-colors duration-[120ms] hover:text-encre-sombre"
        >
          Retour à mes questionnaires
        </a>
      </p>
    </>
  );
}
