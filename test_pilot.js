// Simulate pilot user (no cohort in URL, localStorage empty)
const getParam = (name) => new URLSearchParams("").get(name);
const localStorage_pilot = { getItem: () => null };

const cohort = (getParam('cohort') || localStorage_pilot.getItem('challenge_cohort') || 'pilot').toLowerCase();
const isLms = cohort === 'lms';

console.log('Pilot cohort:', cohort);
console.log('Pilot isLms:', isLms);
console.log('Should add cohort=lms to hub cards?', isLms);

// Simulate LMS user
const cohort_lms = 'lms';
const isLms_lms = cohort_lms === 'lms';
console.log('LMS cohort:', cohort_lms);
console.log('LMS isLms:', isLms_lms);
console.log('Should add cohort=lms to hub cards?', isLms_lms);
