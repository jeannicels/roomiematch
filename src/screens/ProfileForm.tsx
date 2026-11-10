import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { CURRENCY } from '../lib/budget';
import { LIFESTYLE, type Contact, type ContactMethod, type Profile } from '../lib/types';
import { Notice, useLoad } from '../components/ui';

const blank = (id: string): Profile => ({
  id, display_name: '', university: '', course: '', year_of_study: 1, bio: '', looking_for: 'either',
  budget_min: 500, budget_max: 800, preferred_area: '', move_in_date: new Date().toISOString().slice(0, 10),
  lease_months: 12, gender: 'prefer_not_to_say', roommate_gender_pref: 'any', smoker: false,
  okay_with_smoking: false, has_pets: false, okay_with_pets: true, is_visible: true,
  sleep_schedule: 3, cleanliness: 3, noise: 3, guests: 3, study_at_home: 3, social: 3,
});

export function ProfileForm({ userId, onSaved, firstTime }: { userId: string; onSaved: () => void; firstTime?: boolean }) {
  const { data } = useLoad(async () => ({
    profile: await api.getProfile(userId),
    contact: await api.getContact(userId),
  }), [userId]);
  if (!data) return <p className="muted">Loading your profile</p>;
  return <Form key={userId} initial={data.profile ?? blank(userId)} initialContact={data.contact} onSaved={onSaved} firstTime={firstTime} />;
}

function Form({ initial, initialContact, onSaved, firstTime }: {
  initial: Profile; initialContact: Contact | null; onSaved: () => void; firstTime?: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [contact, setContact] = useState<Contact>(initialContact ?? { contact_method: 'email', contact_value: '' });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const text = (key: 'display_name' | 'university' | 'course' | 'preferred_area', label: string, required = true) => (
    <label htmlFor={key}>{label}
      <input id={key} value={form[key]} required={required} maxLength={120} onChange={(e) => set(key, e.target.value)} />
    </label>
  );
  const check = (key: 'smoker' | 'okay_with_smoking' | 'has_pets' | 'okay_with_pets' | 'is_visible', label: string) => (
    <label className="check" htmlFor={key}>
      <input id={key} type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} /> {label}
    </label>
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.budget_max < form.budget_min) return setError('Your maximum budget must be at least your minimum.');
    setBusy(true);
    setError('');
    try {
      await api.saveProfile(form, contact);
      setSaved(true);
      onSaved();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <header className="page-head">
        <h1>{firstTime ? 'Set up your profile' : 'Your profile'}</h1>
        <p>Your answers decide who you see and how they score. Be honest about the habits you would not change.</p>
      </header>

      <fieldset>
        <legend>About you</legend>
        <div className="grid-2">
          {text('display_name', 'Name')}
          {text('university', 'University')}
          {text('course', 'Course', false)}
          <label htmlFor="year_of_study">Year of study
            <input id="year_of_study" type="number" min={1} max={8} value={form.year_of_study} onChange={(e) => set('year_of_study', Number(e.target.value))} />
          </label>
        </div>
        <label htmlFor="bio">Short bio
          <textarea id="bio" rows={3} maxLength={600} value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder="What is a normal week like for you?" />
        </label>
      </fieldset>

      <fieldset>
        <legend>Budget and timing</legend>
        <div className="grid-2">
          <label htmlFor="budget_min">Lowest monthly budget ({CURRENCY})
            <input id="budget_min" type="number" min={0} step={10} required value={form.budget_min} onChange={(e) => set('budget_min', Number(e.target.value))} />
          </label>
          <label htmlFor="budget_max">Highest monthly budget ({CURRENCY})
            <input id="budget_max" type="number" min={0} step={10} required value={form.budget_max} onChange={(e) => set('budget_max', Number(e.target.value))} />
          </label>
          {text('preferred_area', 'Preferred area', false)}
          <label htmlFor="move_in_date">Move-in date
            <input id="move_in_date" type="date" required value={form.move_in_date} onChange={(e) => set('move_in_date', e.target.value)} />
          </label>
          <label htmlFor="lease_months">Lease length in months
            <input id="lease_months" type="number" min={1} max={48} value={form.lease_months} onChange={(e) => set('lease_months', Number(e.target.value))} />
          </label>
          <label htmlFor="looking_for">I am looking for
            <select id="looking_for" value={form.looking_for} onChange={(e) => set('looking_for', e.target.value as Profile['looking_for'])}>
              <option value="either">A room or a roommate</option>
              <option value="room">A room to join</option>
              <option value="roommate">A roommate for my place</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>How you live</legend>
        {LIFESTYLE.map((item) => (
          <div className="scale" key={item.key} role="radiogroup" aria-label={item.label}>
            <strong>{item.label}</strong>
            <div className="scale-options">
              <span>{item.low}</span>
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value} className={form[item.key] === value ? 'scale-on' : ''}>
                  <input type="radio" name={item.key} checked={form[item.key] === value} onChange={() => set(item.key, value)} />
                  <span>{value}</span>
                </label>
              ))}
              <span>{item.high}</span>
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset>
        <legend>Dealbreakers</legend>
        <p className="muted">These remove matches completely, in both directions.</p>
        <div className="grid-2">
          {check('smoker', 'I smoke or vape')}
          {check('okay_with_smoking', 'I can live with a smoker')}
          {check('has_pets', 'I have a pet')}
          {check('okay_with_pets', 'I can live with pets')}
          <label htmlFor="gender">Gender (optional)
            <select id="gender" value={form.gender} onChange={(e) => set('gender', e.target.value as Profile['gender'])}>
              <option value="prefer_not_to_say">Prefer not to say</option>
              <option value="woman">Woman</option>
              <option value="man">Man</option>
              <option value="non_binary">Non-binary</option>
            </select>
          </label>
          <label htmlFor="roommate_gender_pref">Roommate preference
            <select id="roommate_gender_pref" value={form.roommate_gender_pref} onChange={(e) => set('roommate_gender_pref', e.target.value as Profile['roommate_gender_pref'])}>
              <option value="any">Anyone</option>
              <option value="same">Same gender only</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Contact and privacy</legend>
        <p className="muted">Only people whose connection you accept can see this.</p>
        <div className="grid-2">
          <label htmlFor="contact_method">Contact method
            <select id="contact_method" value={contact.contact_method} onChange={(e) => setContact({ ...contact, contact_method: e.target.value as ContactMethod })}>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="telegram">Telegram</option>
              <option value="instagram">Instagram</option>
            </select>
          </label>
          <label htmlFor="contact_value">Contact details
            <input id="contact_value" required maxLength={120} value={contact.contact_value} onChange={(e) => setContact({ ...contact, contact_value: e.target.value })} />
          </label>
        </div>
        {check('is_visible', 'Show my profile in matches')}
      </fieldset>

      {error && <Notice>{error}</Notice>}
      {saved && !firstTime && <Notice tone="info">Profile saved.</Notice>}
      <button className="btn" disabled={busy}>{busy ? 'Saving' : 'Save profile'}</button>
    </form>
  );
}
