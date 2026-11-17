export const APP_VERSION = '1.0.0';

export const RELIGIONS = [
  {value: 'Islam', en: 'Islam', bn: 'ইসলাম'},
  {value: 'Hinduism', en: 'Hinduism', bn: 'হিন্দু ধর্ম'},
  {value: 'Christianity', en: 'Christianity', bn: 'খ্রিস্ট ধর্ম'},
  {value: 'Buddhism', en: 'Buddhism', bn: 'বৌদ্ধ ধর্ম'},
  {value: 'Others', en: 'Others', bn: 'অন্যান্য'},
] as const;

export const GENDERS = [
  {value: 'Male', en: 'Male', bn: 'পুরুষ'},
  {value: 'Female', en: 'Female', bn: 'মহিলা'},
  {value: 'Third Gender', en: 'Third Gender', bn: 'তৃতীয় লিঙ্গ'},
] as const;

export const MARITAL_STATUSES = [
  {value: 'Single', en: 'Single', bn: 'অবিবাহিত'},
  {value: 'Married', en: 'Married', bn: 'বিবাহিত'},
] as const;

export const QUOTA_OPTIONS = [
  {value: 'Non Quota', en: 'Non Quota', bn: 'কোটা নেই'},
  {value: 'Freedom Fighter', en: 'Freedom Fighter (Child/Grandchild)', bn: 'মুক্তিযোদ্ধা কোটা'},
  {value: 'Physically Handicapped', en: 'Physically Challenged', bn: 'শারীরিক প্রতিবন্ধী'},
  {value: 'Orphan', en: 'Orphan', bn: 'এতিম'},
  {value: 'Ethnic Minority', en: 'Ethnic Minority', bn: 'ক্ষুদ্র নৃ-গোষ্ঠী'},
  {value: 'Ansar-VDP', en: 'Ansar-VDP', bn: 'আনসার ও ভিডিপি'},
] as const;

export const DEPARTMENTAL_STATUSES = [
  {value: 'None', en: 'None / General', bn: 'প্রযোজ্য নয়'},
  {value: 'Govt. Employee', en: 'Government Employee', bn: 'সরকারি চাকরিজীবী'},
  {value: 'Semi Govt. Employee', en: 'Semi-Government Employee', bn: 'আধা-সরকারি চাকরিজীবী'},
  {value: 'Autonomous', en: 'Autonomous Body', bn: 'স্বায়ত্তশাসিত প্রতিষ্ঠান'},
  {value: 'Departmental Candidate', en: 'Departmental Candidate', bn: 'বিভাগীয় প্রার্থী'},
] as const;

export const EDUCATION_BOARDS = [
  'Dhaka',
  'Chattogram',
  'Rajshahi',
  'Comilla',
  'Jessore',
  'Sylhet',
  'Dinajpur',
  'Barishal',
  'Mymensingh',
  'Madrasah',
  'Technical',
  'Bangladesh Open University',
  'Others',
] as const;

export const EDUCATION_EXAMINATIONS = [
  {value: 'SSC', category: 'ssc', label: 'SSC'},
  {value: 'Dakhil', category: 'ssc', label: 'Dakhil'},
  {value: 'SSC Vocational', category: 'ssc', label: 'SSC Vocational'},
  {value: 'O Level / Equivalent', category: 'ssc', label: 'O Level / Equivalent'},
  {value: 'HSC', category: 'hsc', label: 'HSC'},
  {value: 'Alim', category: 'hsc', label: 'Alim'},
  {value: 'HSC Vocational', category: 'hsc', label: 'HSC Vocational'},
  {value: 'Diploma', category: 'hsc', label: 'Diploma in Engineering / Equivalent'},
  {value: 'A Level / Equivalent', category: 'hsc', label: 'A Level / Equivalent'},
  {value: 'Graduation', category: 'graduation', label: 'Graduation (B.Sc / B.A / B.Com / BBA / BSS)'},
  {value: 'Masters', category: 'masters', label: 'Masters (M.Sc / M.A / MBA / MSS)'},
  {value: 'Equivalent', category: 'other', label: 'Equivalent Qualification'},
] as const;

export const SSC_HSC_GROUPS = [
  'Science',
  'Business Studies',
  'Humanities',
  'General',
  'Computer',
  'Electrical',
  'Mechanical',
  'Civil',
  'Others',
] as const;

export const COURSE_DURATIONS = [
  '1 Year',
  '2 Years',
  '3 Years',
  '4 Years',
  '5 Years',
] as const;

export const EMPLOYMENT_CATEGORIES = [
  'Government',
  'Semi-Government',
  'Autonomous',
  'Private Sector',
  'NGO / Development',
  'Academic / Research',
  'Self-Employed',
] as const;
