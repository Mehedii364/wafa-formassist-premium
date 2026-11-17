import {LanguageCode} from '../schemas/types';

export type WafaErrorCode =
  | 'UNSUPPORTED_WEBSITE'
  | 'INVALID_APPLICATION_ROUTE'
  | 'PERMISSION_DENIED'
  | 'FORM_NOT_FOUND'
  | 'FIELD_MAPPING_FAILED'
  | 'DROPDOWN_MISMATCH'
  | 'AUTOFILL_FAILURE'
  | 'STORAGE_FAILURE'
  | 'ENCRYPTION_FAILURE'
  | 'BACKUP_CORRUPTION'
  | 'INVALID_PROFILE'
  | 'BROWSER_API_UNAVAILABLE'
  | 'SYNC_UNAVAILABLE'
  | 'SYNC_CONFLICT';

export interface WafaErrorInfo {
  code: WafaErrorCode;
  title: {en: string; bn: string};
  message: {en: string; bn: string};
  recovery: {en: string; bn: string};
}

export const ERROR_CATALOG: Record<WafaErrorCode, WafaErrorInfo> = {
  UNSUPPORTED_WEBSITE: {
    code: 'UNSUPPORTED_WEBSITE',
    title: {en: 'Unsupported Website', bn: 'অসমর্থিত ওয়েবসাইট'},
    message: {
      en: 'This domain is not registered in the verified Website Adapter registry.',
      bn: 'এই ডোমেইনটি অনুমোদিত ওয়েবসাইট অ্যাডাপ্টার তালিকায় নেই।',
    },
    recovery: {
      en: 'Open a supported recruitment portal (such as dgbpo.teletalk.com.bd) or review supported adapters in Website Manager.',
      bn: 'সমর্থিত নিয়োগ পোর্টাল (যেমন dgbpo.teletalk.com.bd) খুলুন অথবা ওয়েবসাইট ম্যানেজারে সমর্থিত সাইটগুলো দেখুন।',
    },
  },
  INVALID_APPLICATION_ROUTE: {
    code: 'INVALID_APPLICATION_ROUTE',
    title: {en: 'Invalid Application Route', bn: 'অকার্যকর আবেদন পথ'},
    message: {
      en: 'The current page path does not match an active application form route.',
      bn: 'বর্তমান পেজের পাথ কোনো সক্রিয় আবেদন ফর্মের সাথে মিলছে না।',
    },
    recovery: {
      en: 'Navigate to the official application form page (e.g., /dgbpo2026/application.php) before scanning.',
      bn: 'স্ক্যান করার আগে অফিসিয়াল আবেদন ফর্ম পেজে (যেমন /dgbpo2026/application.php) যান।',
    },
  },
  PERMISSION_DENIED: {
    code: 'PERMISSION_DENIED',
    title: {en: 'Permission Denied', bn: 'অনুমতি প্রত্যাখ্যাত'},
    message: {
      en: 'Autofill access is not granted for this website domain.',
      bn: 'এই ওয়েবসাইটের জন্য অটোফিল অনুমতি প্রদান করা হয়নি।',
    },
    recovery: {
      en: 'Enable domain permission explicitly in Website Manager or Extension Settings.',
      bn: 'ওয়েবসাইট ম্যানেজার বা এক্সটেনশন সেটিংস থেকে ডোমেইনের অনুমতি সক্রিয় করুন।',
    },
  },
  FORM_NOT_FOUND: {
    code: 'FORM_NOT_FOUND',
    title: {en: 'Application Form Not Found', bn: 'আবেদন ফর্ম পাওয়া যায়নি'},
    message: {
      en: 'No scannable application form inputs were detected on the page.',
      bn: 'এই পেজে স্ক্যান করার মতো কোনো আবেদন ফর্ম পাওয়া যায়নি।',
    },
    recovery: {
      en: 'Wait for dynamic form controls to finish loading, then retry Scan Form.',
      bn: 'পেজের ফর্ম সম্পূর্ণ লোড হওয়া পর্যন্ত অপেক্ষা করুন এবং পুনরায় স্ক্যান করুন।',
    },
  },
  FIELD_MAPPING_FAILED: {
    code: 'FIELD_MAPPING_FAILED',
    title: {en: 'Field Mapping Incomplete', bn: 'ফিল্ড ম্যাপিং অসম্পূর্ণ'},
    message: {
      en: 'One or more website fields could not be mapped with sufficient confidence.',
      bn: 'এক বা একাধিক ওয়েবসাইট ফিল্ড পর্যাপ্ত নির্ভরযোগ্যতার সাথে ম্যাপ করা যায়নি।',
    },
    recovery: {
      en: 'Review unmatched or medium-confidence entries in the Form Review Center and assign or fill manually.',
      bn: 'ফর্ম রিভিউ সেন্টারে অ-ম্যাচড বা মধ্যম-নির্ভরযোগ্য ফিল্ডগুলো যাচাই করে ম্যানুয়ালি পূরণ করুন।',
    },
  },
  DROPDOWN_MISMATCH: {
    code: 'DROPDOWN_MISMATCH',
    title: {en: 'Dropdown Option Unresolved', bn: 'ড্রপডাউন অপশন অমিল'},
    message: {
      en: 'The saved profile value did not uniquely match any option in the website dropdown.',
      bn: 'সংরক্ষিত প্রোফাইল মান ওয়েবসাইটের ড্রপডাউনের কোনো নির্দিষ্ট অপশনের সাথে মেলেনি।',
    },
    recovery: {
      en: 'Select the correct dropdown option manually on the form to prevent inaccurate submission.',
      bn: 'ভুল তথ্য জমা এড়াতে ফর্মে নিজে সঠিক ড্রপডাউন অপশন নির্বাচন করুন।',
    },
  },
  AUTOFILL_FAILURE: {
    code: 'AUTOFILL_FAILURE',
    title: {en: 'Autofill Execution Warning', bn: 'অটোফিল ত্রুটি'},
    message: {
      en: 'Some approved fields did not retain their expected value after autofill verification.',
      bn: 'অটোফিল যাচাইকরণের পরে কিছু অনুমোদিত ফিল্ডের মান সঠিকভাবে বসেনি।',
    },
    recovery: {
      en: 'Inspect the highlighted fields in the post-fill report and enter them manually.',
      bn: 'রিপোর্টে চিহ্নিত ফিল্ডগুলো যাচাই করে ম্যানুয়ালি পূরণ করুন।',
    },
  },
  STORAGE_FAILURE: {
    code: 'STORAGE_FAILURE',
    title: {en: 'Local Storage Error', bn: 'লোকাল স্টোরেজ ত্রুটি'},
    message: {
      en: 'Failed to read or write records in local IndexedDB storage.',
      bn: 'লোকাল IndexedDB স্টোরেজে তথ্য সংরক্ষণ বা পড়তে ব্যর্থ হয়েছে।',
    },
    recovery: {
      en: 'Check browser storage quota, exit private browsing mode, or export an encrypted backup immediately.',
      bn: 'ব্রাউজারের স্টোরেজ খালি আছে কিনা দেখুন অথবা এনক্রিপ্টেড ব্যাকআপ সংরক্ষণ করুন।',
    },
  },
  ENCRYPTION_FAILURE: {
    code: 'ENCRYPTION_FAILURE',
    title: {en: 'Encryption / Decryption Failed', bn: 'এনক্রিপশন / ডিক্রিপশন ব্যর্থ'},
    message: {
      en: 'The passphrase is incorrect or the encrypted payload failed authentication.',
      bn: 'পাসফ্রেজ সঠিক নয় অথবা এনক্রিপ্টেড ডেটা যাচাইয়ে ব্যর্থ হয়েছে।',
    },
    recovery: {
      en: 'Verify your vault passphrase carefully. Lost passphrases cannot be recovered without a separate backup.',
      bn: 'আপনার ভল্ট পাসফ্রেজ সঠিকভাবে যাচাই করুন। হারিয়ে যাওয়া পাসফ্রেজ পুনরুদ্ধার করা সম্ভব নয়।',
    },
  },
  BACKUP_CORRUPTION: {
    code: 'BACKUP_CORRUPTION',
    title: {en: 'Backup File Corrupted or Invalid', bn: 'ব্যাকআপ ফাইল ত্রুটিপূর্ণ'},
    message: {
      en: 'Backup schema version or SHA-256 integrity verification failed.',
      bn: 'ব্যাকআপ স্কিমা সংস্করণ বা SHA-256 অখণ্ডতা যাচাই ব্যর্থ হয়েছে।',
    },
    recovery: {
      en: 'Choose an unmodified WAFA FormAssist backup file and verify the encryption passphrase if encrypted.',
      bn: 'অপরিবর্তিত WAFA FormAssist ব্যাকআপ ফাইল নির্বাচন করুন এবং পাসফ্রেজ যাচাই করুন।',
    },
  },
  INVALID_PROFILE: {
    code: 'INVALID_PROFILE',
    title: {en: 'Invalid Profile Data', bn: 'অসম্পূর্ণ বা অকার্যকর প্রোফাইল'},
    message: {
      en: 'Required applicant fields are missing or formatted incorrectly.',
      bn: 'প্রয়োজনীয় আবেদনকারীর তথ্য অনুপস্থিত বা ভুল বিন্যাসে রয়েছে।',
    },
    recovery: {
      en: 'Open the Validation Center to review and correct each flagged field.',
      bn: 'ভ্যালিডেশন সেন্টারে গিয়ে চিহ্নিত প্রতিটি ফিল্ড সংশোধন করুন।',
    },
  },
  BROWSER_API_UNAVAILABLE: {
    code: 'BROWSER_API_UNAVAILABLE',
    title: {en: 'Browser API Unavailable', bn: 'ব্রাউজার API অনুপলব্ধ'},
    message: {
      en: 'Required Web Crypto, IndexedDB, or Chrome Extension runtime APIs are unavailable in this context.',
      bn: 'এই পরিবেশে প্রয়োজনীয় Web Crypto, IndexedDB বা এক্সটেনশন API উপলব্ধ নয়।',
    },
    recovery: {
      en: 'Use a modern Chromium/Edge browser over HTTPS or localhost, and install the unpacked extension for live browser tab control.',
      bn: 'আধুনিক Chrome বা Edge ব্রাউজার ব্যবহার করুন এবং লাইভ ট্যাব নিয়ন্ত্রণের জন্য এক্সটেনশন ইনস্টল করুন।',
    },
  },
  SYNC_UNAVAILABLE: {
    code: 'SYNC_UNAVAILABLE',
    title: {en: 'Cloud Sync Unreachable', bn: 'ক্লাউড সিঙ্ক অনুপলব্ধ'},
    message: {
      en: 'The optional cloud sync service could not be reached. Your local data remains completely safe offline.',
      bn: 'ঐচ্ছিক ক্লাউড সিঙ্ক সার্ভারের সাথে সংযোগ করা যায়নি। আপনার লোকাল ডেটা অফলাইনে সম্পূর্ণ নিরাপদ।',
    },
    recovery: {
      en: 'Continue working offline; pending changes remain queued and will retry automatically when connectivity returns.',
      bn: 'অফলাইনে কাজ চালিয়ে যান; অপেক্ষমাণ পরিবর্তনগুলো সংযোগ ফিরলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।',
    },
  },
  SYNC_CONFLICT: {
    code: 'SYNC_CONFLICT',
    title: {en: 'Synchronization Conflict Detected', bn: 'সিঙ্ক বিরোধ শনাক্ত হয়েছে'},
    message: {
      en: 'Both local and cloud vaults changed since the last sync. Neither version was overwritten.',
      bn: 'সর্বশেষ সিঙ্কের পর লোকাল এবং ক্লাউড উভয় ভল্টেই পরিবর্তন হয়েছে। কোনো সংস্করণ মুছে ফেলা হয়নি।',
    },
    recovery: {
      en: 'Open Sync Center to compare and explicitly choose whether to keep Local, Cloud, or Merge both.',
      bn: 'সিঙ্ক সেন্টারে গিয়ে লোকাল, ক্লাউড অথবা উভয় সংস্করণ একত্রিত করার সিদ্ধান্ত নিন।',
    },
  },
};

export function formatWafaError(code: WafaErrorCode, lang: LanguageCode): {
  title: string;
  message: string;
  recovery: string;
} {
  const entry = ERROR_CATALOG[code];
  return {
    title: entry.title[lang],
    message: entry.message[lang],
    recovery: entry.recovery[lang],
  };
}
