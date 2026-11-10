import { money } from './budget';
import { LIFESTYLE, scoreMatch, type Analysis, type Profile } from './types';

/** Builds the written report from both students' answers. Runs in the browser, with no AI service. */
export function buildReport(me: Profile, other: Profile): Analysis {
  const match = scoreMatch(me, other);
  const first = other.display_name.split(' ')[0];
  const verdict = match.score >= 75 ? 'strong' : match.score >= 55 ? 'workable' : 'difficult';
  const close = match.closest.map((gap) => gap.label.toLowerCase()).join(' and ');

  const strengths = [`Your answers on ${close} are close, so these should need little negotiation.`];
  if (match.shared_budget) {
    strengths.push(`You share a budget of ${money(match.shared_budget.min)} to ${money(match.shared_budget.max)} a month.`);
  }
  if (match.days_apart <= 30) strengths.push('Your move-in dates are within a month of each other.');

  const friction = match.widest.map((gap) => {
    const item = LIFESTYLE.find((entry) => entry.key === gap.key)!;
    return `${item.label}: you are ${gap.distance} points apart. Agree what works for you both before moving in.`;
  });
  if (!match.shared_budget) friction.push('Your budgets do not overlap. Look at places with more people sharing the rent.');
  if (match.days_apart > 60) friction.push(`Your move-in dates are ${match.days_apart} days apart, so one of you may need to change plans.`);
  if (!friction.length) friction.push('No large gaps. Agree early how you will split chores and bills.');

  return {
    summary: `This looks like a ${verdict} match. You and ${first} score ${match.score} out of 100 on lifestyle, budget and move-in timing.`,
    strengths,
    friction,
    questions: [
      `What does a normal weeknight look like for you, ${first}?`,
      'How should we split bills and shared groceries?',
      'What should we do if one of us wants to move out early?',
    ],
  };
}
