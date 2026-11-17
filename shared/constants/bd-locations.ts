/**
 * Authoritative Bangladesh 8 Divisions and 64 Districts with curated Upazila/Thana lists.
 * Postal codes are NOT fabricated here — users enter verified post office names & 4-digit post codes
 * with manual-entry fallback always enabled for any unlisted Upazila or Thana.
 */
export interface DistrictEntry {
  district: string;
  districtBn: string;
  division: string;
  upazilas: string[];
}

export const BD_DISTRICTS: DistrictEntry[] = [
  // Dhaka Division
  {district: 'Dhaka', districtBn: 'ঢাকা', division: 'Dhaka', upazilas: ['Dhamrai', 'Dohar', 'Keraniganj', 'Nawabganj', 'Savar', 'Dhanmondi', 'Gulshan', 'Mirpur', 'Mohammadpur', 'Motijheel', 'Ramna', 'Tejgaon', 'Uttara']},
  {district: 'Faridpur', districtBn: 'ফরিদপুর', division: 'Dhaka', upazilas: ['Alfadanga', 'Bhanga', 'Boalmari', 'Charbhadrasan', 'Faridpur Sadar', 'Madhukhali', 'Nagarkanda', 'Sadarpur', 'Saltha']},
  {district: 'Gazipur', districtBn: 'গাজীপুর', division: 'Dhaka', upazilas: ['Gazipur Sadar', 'Kaliakair', 'Kaliganj', 'Kapasia', 'Sreepur', 'Tongi']},
  {district: 'Gopalganj', districtBn: 'গোপালগঞ্জ', division: 'Dhaka', upazilas: ['Gopalganj Sadar', 'Kashiani', 'Kotalipara', 'Muksudpur', 'Tungipara']},
  {district: 'Kishoreganj', districtBn: 'কিশোরগঞ্জ', division: 'Dhaka', upazilas: ['Austagram', 'Bajitpur', 'Bhairab', 'Hossainpur', 'Itna', 'Karimganj', 'Katiadi', 'Kishoreganj Sadar', 'Kuliarchar', 'Mithamain', 'Nikli', 'Pakundia', 'Tarail']},
  {district: 'Madaripur', districtBn: 'মাদারীপুর', division: 'Dhaka', upazilas: ['Kalkini', 'Madaripur Sadar', 'Rajoir', 'Shibchar', 'Dasar']},
  {district: 'Manikganj', districtBn: 'মানিকগঞ্জ', division: 'Dhaka', upazilas: ['Daulatpur', 'Ghior', 'Harirampur', 'Manikganj Sadar', 'Saturia', 'Shivalaya', 'Singair']},
  {district: 'Munshiganj', districtBn: 'মুন্সীগঞ্জ', division: 'Dhaka', upazilas: ['Gazaria', 'Lohajang', 'Munshiganj Sadar', 'Sirajdikhan', 'Sreenagar', 'Tongibari']},
  {district: 'Narayanganj', districtBn: 'নারায়ণগঞ্জ', division: 'Dhaka', upazilas: ['Araihazar', 'Bandar', 'Narayanganj Sadar', 'Rupganj', 'Sonargaon']},
  {district: 'Narsingdi', districtBn: 'নরসিংদী', division: 'Dhaka', upazilas: ['Belabo', 'Monohardi', 'Narsingdi Sadar', 'Palash', 'Raipura', 'Shibpur']},
  {district: 'Rajbari', districtBn: 'রাজবাড়ী', division: 'Dhaka', upazilas: ['Baliakandi', 'Goalandaghat', 'Kalukhali', 'Pangsha', 'Rajbari Sadar']},
  {district: 'Shariatpur', districtBn: 'শরীয়তপুর', division: 'Dhaka', upazilas: ['Bhedarganj', 'Damudya', 'Gosairhat', 'Naria', 'Shariatpur Sadar', 'Zajira']},
  {district: 'Tangail', districtBn: 'টাঙ্গাইল', division: 'Dhaka', upazilas: ['Basail', 'Bhuapur', 'Delduar', 'Dhanbari', 'Ghatail', 'Gopalpur', 'Kalihati', 'Madhupur', 'Mirzapur', 'Nagarpur', 'Sakhipur', 'Tangail Sadar']},

  // Chattogram Division
  {district: 'Bandarban', districtBn: 'বান্দরবান', division: 'Chattogram', upazilas: ['Alikadam', 'Bandarban Sadar', 'Lama', 'Naikhongchhari', 'Rowangchhari', 'Ruma', 'Thanchi']},
  {district: 'Brahmanbaria', districtBn: 'ব্রাহ্মণবাড়িয়া', division: 'Chattogram', upazilas: ['Akhaura', 'Ashuganj', 'Bancharampur', 'Bijoynagar', 'Brahmanbaria Sadar', 'Kasba', 'Nabinagar', 'Nasirnagar', 'Sarail']},
  {district: 'Chandpur', districtBn: 'চাঁদপুর', division: 'Chattogram', upazilas: ['Chandpur Sadar', 'Faridganj', 'Haimchar', 'Haziganj', 'Kachua', 'Matlab Dakshin', 'Matlab Uttar', 'Shahrasti']},
  {district: 'Chattogram', districtBn: 'চট্টগ্রাম', division: 'Chattogram', upazilas: ['Anwara', 'Banshkhali', 'Boalkhali', 'Chandanaish', 'Fatikchhari', 'Hathazari', 'Karnaphuli', 'Lohagara', 'Mirsharai', 'Patiya', 'Rangunia', 'Raozan', 'Sandwip', 'Satkania', 'Sitakunda', 'Kotwali', 'Panchlaish']},
  {district: 'Cumilla', districtBn: 'কুমিল্লা', division: 'Chattogram', upazilas: ['Barura', 'Brahmanpara', 'Burichang', 'Chandina', 'Chauddagram', 'Cumilla Adarsha Sadar', 'Cumilla Sadar Dakshin', 'Daudkandi', 'Debidwar', 'Homna', 'Laksam', 'Lalmai', 'Meghna', 'Monohargonj', 'Muradnagar', 'Nangalkot', 'Titas']},
  {district: "Cox's Bazar", districtBn: 'কক্সবাজার', division: 'Chattogram', upazilas: ['Chakaria', "Cox's Bazar Sadar", 'Eidgaon', 'Kutubdia', 'Maheshkhali', 'Pekua', 'Ramu', 'Teknaf', 'Ukhia']},
  {district: 'Feni', districtBn: 'ফেনী', division: 'Chattogram', upazilas: ['Chhagalnaiya', 'Daganbhuiyan', 'Feni Sadar', 'Fulgazi', 'Parshuram', 'Sonagazi']},
  {district: 'Khagrachhari', districtBn: 'খাগড়াছড়ি', division: 'Chattogram', upazilas: ['Dighinala', 'Guimara', 'Khagrachhari Sadar', 'Lakshmichhari', 'Mahalchhari', 'Manikchhari', 'Matiranga', 'Panchhari', 'Ramgarh']},
  {district: 'Lakshmipur', districtBn: 'লক্ষ্মীপুর', division: 'Chattogram', upazilas: ['Kamalnagar', 'Lakshmipur Sadar', 'Raipur', 'Ramganj', 'Ramgati']},
  {district: 'Noakhali', districtBn: 'নোয়াখালী', division: 'Chattogram', upazilas: ['Begumganj', 'Chatkhil', 'Companiganj', 'Hatiya', 'Kabirhat', 'Noakhali Sadar', 'Senbagh', 'Sonaimuri', 'Subarnachar']},
  {district: 'Rangamati', districtBn: 'রাঙ্গামাটি', division: 'Chattogram', upazilas: ['Bagaichhari', 'Barkal', 'Belaichhari', 'Juraichhari', 'Kaptai', 'Kawkhali', 'Langadu', 'Naniarchar', 'Rajasthali', 'Rangamati Sadar']},

  // Rajshahi Division
  {district: 'Bogura', districtBn: 'বগুড়া', division: 'Rajshahi', upazilas: ['Adamdighi', 'Bogura Sadar', 'Dhunat', 'Dhupchanchia', 'Gabtali', 'Kahaloo', 'Nandigram', 'Sariakandi', 'Shajahanpur', 'Sherpur', 'Shibganj', 'Sonatala']},
  {district: 'Chapainawabganj', districtBn: 'চাঁপাইনবাবগঞ্জ', division: 'Rajshahi', upazilas: ['Bholahat', 'Chapainawabganj Sadar', 'Gomastapur', 'Nachole', 'Shibganj']},
  {district: 'Joypurhat', districtBn: 'জয়পুরহাট', division: 'Rajshahi', upazilas: ['Akkelpur', 'Joypurhat Sadar', 'Kalai', 'Khetlal', 'Panchbibi']},
  {district: 'Naogaon', districtBn: 'নওগাঁ', division: 'Rajshahi', upazilas: ['Atrai', 'Badalgachhi', 'Dhamoirhat', 'Manda', 'Mahadebpur', 'Naogaon Sadar', 'Niamatpur', 'Patnitala', 'Porsha', 'Raninagar', 'Sapahar']},
  {district: 'Natore', districtBn: 'নাটোর', division: 'Rajshahi', upazilas: ['Bagatipara', 'Baraigram', 'Gurudaspur', 'Lalpur', 'Naldanga', 'Natore Sadar', 'Singra']},
  {district: 'Pabna', districtBn: 'পাবনা', division: 'Rajshahi', upazilas: ['Atgharia', 'Bera', 'Bhangura', 'Chatmohar', 'Faridpur', 'Ishwardi', 'Pabna Sadar', 'Santhia', 'Sujanagar']},
  {district: 'Rajshahi', districtBn: 'রাজশাহী', division: 'Rajshahi', upazilas: ['Bagha', 'Bagmara', 'Charghat', 'Durgapur', 'Godagari', 'Mohanpur', 'Paba', 'Puthia', 'Tanore', 'Boalia', 'Motihar']},
  {district: 'Sirajganj', districtBn: 'সিরাজগঞ্জ', division: 'Rajshahi', upazilas: ['Belkuchi', 'Chauhali', 'Kamarkhanda', 'Kazipur', 'Raiganj', 'Shahjadpur', 'Sirajganj Sadar', 'Tarash', 'Ullahpara']},

  // Khulna Division
  {district: 'Bagerhat', districtBn: 'বাগেরহাট', division: 'Khulna', upazilas: ['Bagerhat Sadar', 'Chitalmari', 'Fakirhat', 'Kachua', 'Mollahat', 'Mongla', 'Morrelganj', 'Rampal', 'Sarankhola']},
  {district: 'Chuadanga', districtBn: 'চুয়াডাঙ্গা', division: 'Khulna', upazilas: ['Alamdanga', 'Chuadanga Sadar', 'Damurhuda', 'Jibannagar']},
  {district: 'Jashore', districtBn: 'যশোর', division: 'Khulna', upazilas: ['Abhaynagar', 'Bagherpara', 'Chaugachha', 'Jashore Sadar', 'Jhikargachha', 'Keshabpur', 'Manirampur', 'Sharsha']},
  {district: 'Jhenaidah', districtBn: 'ঝিনাইদহ', division: 'Khulna', upazilas: ['Harinakunda', 'Jhenaidah Sadar', 'Kaliganj', 'Kotchandpur', 'Maheshpur', 'Shailkupa']},
  {district: 'Khulna', districtBn: 'খুলনা', division: 'Khulna', upazilas: ['Batiaghata', 'Dacope', 'Dighalia', 'Dumuria', 'Koyra', 'Paikgachha', 'Phultala', 'Rupsha', 'Terokhada', 'Khalishpur', 'Sonadanga']},
  {district: 'Kushtia', districtBn: 'কুষ্টিয়া', division: 'Khulna', upazilas: ['Bheramara', 'Daulatpur', 'Khoksa', 'Kumarkhali', 'Kushtia Sadar', 'Mirpur']},
  {district: 'Magura', districtBn: 'মাগুরা', division: 'Khulna', upazilas: ['Magura Sadar', 'Mohammadpur', 'Shalikha', 'Sreepur']},
  {district: 'Meherpur', districtBn: 'মেহেরপুর', division: 'Khulna', upazilas: ['Gangni', 'Meherpur Sadar', 'Mujibnagar']},
  {district: 'Narail', districtBn: 'নড়াইল', division: 'Khulna', upazilas: ['Kalia', 'Lohagara', 'Narail Sadar']},
  {district: 'Satkhira', districtBn: 'সাতক্ষীরা', division: 'Khulna', upazilas: ['Assasuni', 'Debhata', 'Kalaroa', 'Kaliganj', 'Satkhira Sadar', 'Shyamnagar', 'Tala']},

  // Barishal Division
  {district: 'Barguna', districtBn: 'বরগুনা', division: 'Barishal', upazilas: ['Amtali', 'Bamna', 'Barguna Sadar', 'Betagi', 'Patharghata', 'Taltali']},
  {district: 'Barishal', districtBn: 'বরিশাল', division: 'Barishal', upazilas: ['Agailjhara', 'Babuganj', 'Bakerganj', 'Banaripara', 'Barishal Sadar', 'Gaurnadi', 'Hizla', 'Mehendiganj', 'Muladi', 'Wazirpur']},
  {district: 'Bhola', districtBn: 'ভোলা', division: 'Barishal', upazilas: ['Bhola Sadar', 'Burhanuddin', 'Char Fasson', 'Daulatkhan', 'Lalmohan', 'Manpura', 'Tazumuddin']},
  {district: 'Jhalokati', districtBn: 'ঝালকাঠি', division: 'Barishal', upazilas: ['Jhalokati Sadar', 'Kathalia', 'Nalchity', 'Rajapur']},
  {district: 'Patuakhali', districtBn: 'পটুয়াখালী', division: 'Barishal', upazilas: ['Bauphal', 'Dashmina', 'Dumki', 'Galachipa', 'Kalapara', 'Mirzaganj', 'Patuakhali Sadar', 'Rangabali']},
  {district: 'Pirojpur', districtBn: 'পিরোজপুর', division: 'Barishal', upazilas: ['Bhandaria', 'Indurkani', 'Kawkhali', 'Mathbaria', 'Nazirpur', 'Nesarabad', 'Pirojpur Sadar']},

  // Sylhet Division
  {district: 'Habiganj', districtBn: 'হবিগঞ্জ', division: 'Sylhet', upazilas: ['Ajmiriganj', 'Bahubal', 'Baniachong', 'Chunarughat', 'Habiganj Sadar', 'Lakhai', 'Madhabpur', 'Nabiganj', 'Shaistaganj']},
  {district: 'Moulvibazar', districtBn: 'মৌলভীবাজার', division: 'Sylhet', upazilas: ['Barlekha', 'Juri', 'Kamalganj', 'Kulaura', 'Moulvibazar Sadar', 'Rajnagar', 'Sreemangal']},
  {district: 'Sunamganj', districtBn: 'সুনামগঞ্জ', division: 'Sylhet', upazilas: ['Bishwamvarpur', 'Chhatak', 'Derai', 'Dharamapasha', 'Dowarabazar', 'Jagannathpur', 'Jamalganj', 'Madhyanagar', 'Shantiganj', 'Sulla', 'Sunamganj Sadar', 'Tahirpur']},
  {district: 'Sylhet', districtBn: 'সিলেট', division: 'Sylhet', upazilas: ['Balaganj', 'Beanibazar', 'Bishwanath', 'Companiganj', 'Dakshin Surma', 'Fenchuganj', 'Golapganj', 'Gowainghat', 'Jaintiapur', 'Kanaighat', 'Osmani Nagar', 'Sylhet Sadar', 'Zakiganj']},

  // Rangpur Division
  {district: 'Dinajpur', districtBn: 'দিনাজপুর', division: 'Rangpur', upazilas: ['Birampur', 'Birganj', 'Biral', 'Bochaganj', 'Chirirbandar', 'Dinajpur Sadar', 'Fulbari', 'Ghoraghat', 'Hakimpur', 'Kaharole', 'Khansama', 'Nawabganj', 'Parbatipur']},
  {district: 'Gaibandha', districtBn: 'গাইবান্ধা', division: 'Rangpur', upazilas: ['Fulchhari', 'Gaibandha Sadar', 'Gobindaganj', 'Palashbari', 'Sadullapur', 'Saghata', 'Sundarganj']},
  {district: 'Kurigram', districtBn: 'কুড়িগ্রাম', division: 'Rangpur', upazilas: ['Bhurungamari', 'Char Rajibpur', 'Chilmari', 'Kurigram Sadar', 'Nageshwari', 'Phulbari', 'Rajarhat', 'Raomari', 'Ulipur']},
  {district: 'Lalmonirhat', districtBn: 'লালমনিরহাট', division: 'Rangpur', upazilas: ['Aditmari', 'Hatibandha', 'Kaliganj', 'Lalmonirhat Sadar', 'Patgram']},
  {district: 'Nilphamari', districtBn: 'নীলফামারী', division: 'Rangpur', upazilas: ['Dimla', 'Domar', 'Jaldhaka', 'Kishoreganj', 'Nilphamari Sadar', 'Saidpur']},
  {district: 'Panchagarh', districtBn: 'পঞ্চগড়', division: 'Rangpur', upazilas: ['Atwari', 'Boda', 'Debiganj', 'Panchagarh Sadar', 'Tetulia']},
  {district: 'Rangpur', districtBn: 'রংপুর', division: 'Rangpur', upazilas: ['Badarganj', 'Gangachhara', 'Kaunia', 'Mithapukur', 'Pirgachha', 'Pirganj', 'Rangpur Sadar', 'Taraganj']},
  {district: 'Thakurgaon', districtBn: 'ঠাকুরগাঁও', division: 'Rangpur', upazilas: ['Baliadangi', 'Haripur', 'Pirganj', 'Ranisankail', 'Thakurgaon Sadar']},

  // Mymensingh Division
  {district: 'Jamalpur', districtBn: 'জামালপুর', division: 'Mymensingh', upazilas: ['Bakshiganj', 'Dewanganj', 'Islampur', 'Jamalpur Sadar', 'Madarganj', 'Melandaha', 'Sarishabari']},
  {district: 'Mymensingh', districtBn: 'ময়মনসিংহ', division: 'Mymensingh', upazilas: ['Bhaluka', 'Dhobaura', 'Fulbaria', 'Gaffargaon', 'Gauripur', 'Haluaghat', 'Ishwarganj', 'Muktagachha', 'Mymensingh Sadar', 'Nandail', 'Phulpur', 'Tarakanda', 'Trishal']},
  {district: 'Netrokona', districtBn: 'নেত্রকোণা', division: 'Mymensingh', upazilas: ['Atpara', 'Barhatta', 'Durgapur', 'Kalmakanda', 'Kendua', 'Khaliajuri', 'Madan', 'Mohanganj', 'Netrokona Sadar', 'Purbadhala']},
  {district: 'Sherpur', districtBn: 'শেরপুর', division: 'Mymensingh', upazilas: ['Jhenaigati', 'Nakla', 'Nalitabari', 'Sherpur Sadar', 'Sreebardi']},
];

export function findDistrictEntry(districtName: string): DistrictEntry | undefined {
  const normalized = districtName.trim().toLowerCase();
  if (!normalized) return undefined;
  return BD_DISTRICTS.find(
    (d) =>
      d.district.toLowerCase() === normalized ||
      d.districtBn === districtName.trim() ||
      (normalized === 'comilla' && d.district === 'Cumilla') ||
      (normalized === 'jessore' && d.district === 'Jashore') ||
      (normalized === 'bogra' && d.district === 'Bogura') ||
      (normalized === 'chittagong' && d.district === 'Chattogram') ||
      (normalized === 'barisal' && d.district === 'Barishal'),
  );
}

export function isKnownUpazilaForDistrict(districtName: string, upazilaName: string): boolean | null {
  const entry = findDistrictEntry(districtName);
  if (!entry) return null; // Unknown district -> cannot assert mismatch
  const norm = upazilaName.trim().toLowerCase();
  if (!norm) return false;
  return entry.upazilas.some((u) => u.toLowerCase() === norm);
}
