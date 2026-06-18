// Test day1->day2 navigation with different scenarios

function testNav(pid, bypass, cohort, cohortStored) {
  const params = new URLSearchParams(bypass ? 'bypass=1' : '');
  if (cohort) params.append('cohort', cohort);
  
  const bypass_val = params.get('bypass');
  const cohort_param = params.get('cohort') || cohortStored || '';
  
  const qs = [];
  if (pid) qs.push('pid=' + encodeURIComponent(pid));
  if (bypass_val === '1') qs.push('bypass=1');
  if (cohort_param.toLowerCase() === 'lms') qs.push('cohort=lms');
  
  const url = 'day2.html' + (qs.length ? '?' + qs.join('&') : '');
  return url;
}

console.log('PILOT with pid:', testNav('abc123', false, '', ''));
console.log('PILOT with bypass, pid:', testNav('abc123', true, '', ''));
console.log('LMS with pid:', testNav('abc123', false, 'lms', ''));
console.log('LMS without pid:', testNav('', false, 'lms', 'lms'));
console.log('Pilot bypass (no pid):', testNav('', true, '', ''));
