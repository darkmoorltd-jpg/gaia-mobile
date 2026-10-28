// Subdivisions with full secondary data for Nigeria, Ghana, Kenya
// For other countries → free-text fallback in the UI

export type SubdivisionData = {
  primary: Record<string, string[]>; // { "State/Region name": ["LGA1", "LGA2", ...] }
};

// ============================================================
// NIGERIA — 37 states/territories → 774 LGAs
// ============================================================
const NG: SubdivisionData = {
  primary: {
    'Abia': ['Aba North','Aba South','Arochukwu','Bende','Ikwuano','Isiala-Ngwa North','Isiala-Ngwa South','Isuikwuato','Obi Ngwa','Ohafia','Osisioma Ngwa','Ugwunagbo','Ukwa East','Ukwa West','Umuahia North','Umuahia South','Umu Nneochi'],
    'Adamawa': ['Demsa','Fufore','Ganye','Girei','Gombi','Guyuk','Hong','Jada','Lamurde','Madagali','Maiha','Mayo-Belwa','Michika','Mubi North','Mubi South','Numan','Shelleng','Song','Toungo','Yola North','Yola South'],
    'Akwa Ibom': ['Abak','Eastern Obolo','Eket','Esit Eket','Essien Udim','Etim Ekpo','Etinan','Ibeno','Ibesikpo Asutan','Ibiono Ibom','Ika','Ikono','Ikot Abasi','Ikot Ekpene','Ini','Itu','Mbo','Mkpat Enin','Nsit Atai','Nsit Ibom','Nsit Ubium','Obot Akara','Okobo','Onna','Oron','Oruk Anam','Udung Uko','Ukanafun','Uruan','Urue-Offong/Oruko','Uyo'],
    'Anambra': ['Aguata','Anambra East','Anambra West','Anaocha','Awka North','Awka South','Ayamelum','Dunukofia','Ekwusigo','Idemili North','Idemili South','Ihiala','Njikoka','Nnewi North','Nnewi South','Ogbaru','Onitsha North','Onitsha South','Orumba North','Orumba South','Oyi'],
    'Bauchi': ['Alkaleri','Bauchi','Bogoro','Damban','Darazo','Dass','Gamawa','Ganjuwa','Giade','Itas/Gadau',"Jama'are",'Katagum','Kirfi','Misau','Ningi','Shira','Tafawa Balewa','Toro','Warji','Zaki'],
    'Bayelsa': ['Brass','Ekeremor','Kolokuma/Opokuma','Nembe','Ogbia','Sagbama','Southern Ijaw','Yenagoa'],
    'Benue': ['Ado','Agatu','Apa','Buruku','Gboko','Guma','Gwer East','Gwer West','Katsina-Ala','Konshisha','Kwande','Logo','Makurdi','Obi','Ogbadibo','Ohimini','Oju','Okpokwu','Otukpo','Tarka','Ukum','Ushongo','Vandeikya'],
    'Borno': ['Abadam','Askira/Uba','Bama','Bayo','Biu','Chibok','Damboa','Dikwa','Gubio','Guzamala','Gwoza','Hawul','Jere','Kaga','Kala/Balge','Konduga','Kukawa','Kwaya Kusar','Mafa','Magumeri','Maiduguri','Marte','Mobbar','Monguno','Ngala','Nganzai','Shani'],
    'Cross River': ['Abi','Akamkpa','Akpabuyo','Bakassi','Bekwarra','Biase','Boki','Calabar Municipal','Calabar South','Etung','Ikom','Obanliku','Obubra','Obudu','Odukpani','Ogoja','Yakurr','Yala'],
    'Delta': ['Aniocha North','Aniocha South','Bomadi','Burutu','Ethiope East','Ethiope West','Ika North East','Ika South','Isoko North','Isoko South','Ndokwa East','Ndokwa West','Okpe','Oshimili North','Oshimili South','Patani','Sapele','Udu','Ughelli North','Ughelli South','Ukwuani','Uvwie','Warri North','Warri South','Warri South West'],
    'Ebonyi': ['Abakaliki','Afikpo North','Afikpo South','Ebonyi','Ezza North','Ezza South','Ikwo','Ishielu','Ivo','Izzi','Ohaozara','Ohaukwu','Onicha'],
    'Edo': ['Akoko-Edo','Egor','Esan Central','Esan North-East','Esan South-East','Esan West','Etsako Central','Etsako East','Etsako West','Igueben','Ikpoba-Okha','Orhionmwon','Oredo','Ovia North-East','Ovia South-West','Owan East','Owan West','Uhunmwonde'],
    'Ekiti': ['Ado-Ekiti','Efon','Ekiti East','Ekiti South-West','Ekiti West','Emure','Gbonyin','Ido-Osi','Ijero','Ikere','Ikole','Ilejemeje','Irepodun/Ifelodun','Ise/Orun','Moba','Oye'],
    'Enugu': ['Aninri','Awgu','Enugu East','Enugu North','Enugu South','Ezeagu','Igbo Etiti','Igbo Eze North','Igbo Eze South','Isi Uzo','Nkanu East','Nkanu West','Nsukka','Oji River','Udenu','Udi','Uzo-Uwani'],
    'FCT Abuja': ['Abaji','Bwari','Gwagwalada','Kuje','Kwali','Municipal Area Council'],
    'Gombe': ['Akko','Balanga','Billiri','Dukku','Funakaye','Gombe','Kaltungo','Kwami','Nafada','Shongom','Yamaltu/Deba'],
    'Imo': ['Aboh Mbaise','Ahiazu Mbaise','Ehime Mbano','Ezinihitte','Ideato North','Ideato South','Ihitte/Uboma','Ikeduru','Isiala Mbano','Isu','Mbaitoli','Ngor Okpala','Njaba','Nkwerre','Nwangele','Obowo','Oguta','Ohaji/Egbema','Okigwe','Orlu','Orsu','Oru East','Oru West','Owerri Municipal','Owerri North','Owerri West','Unuimo'],
    'Jigawa': ['Auyo','Babura','Biriniwa','Birnin Kudu','Buji','Dutse','Gagarawa','Garki','Gumel','Guri','Gwaram','Gwiwa','Hadejia','Jahun','Kafin Hausa','Kaugama','Kazaure','Kiri Kasama','Kiyawa','Maigatari','Malam Madori','Miga','Ringim','Roni','Sule Tankarkar','Taura','Yankwashi'],
    'Kaduna': ['Birnin Gwari','Chikun','Giwa','Igabi','Ikara','Jaba',"Jema'a",'Kachia','Kaduna North','Kaduna South','Kagarko','Kajuru','Kaura','Kauru','Kubau','Kudan','Lere','Makarfi','Sabon Gari','Sanga','Soba','Zangon Kataf','Zaria'],
    'Kano': ['Ajingi','Albasu','Bagwai','Bebeji','Bichi','Bunkure','Dala','Dambatta','Dawakin Kudu','Dawakin Tofa','Doguwa','Fagge','Gabasawa','Garko','Garun Mallam','Gaya','Gezawa','Gwale','Gwarzo','Kabo','Kano Municipal','Karaye','Kibiya','Kiru','Kumbotso','Kunchi','Kura','Madobi','Makoda','Minjibir','Nasarawa','Rano','Rimin Gado','Rogo','Shanono','Sumaila','Takai','Tarauni','Tofa','Tsanyawa','Tudun Wada','Ungogo','Warawa','Wudil'],
    'Katsina': ['Bakori','Batagarawa','Batsari','Baure','Bindawa','Charanchi','Dandume','Danja','Dan Musa','Daura','Dutsi','Dutsin Ma','Faskari','Funtua','Ingawa','Jibia','Kafur','Kaita','Kankara','Kankia','Katsina','Kurfi','Kusada',"Mai'Adua",'Malumfashi','Mani','Mashi','Matazu','Musawa','Rimi','Sabuwa','Safana','Sandamu','Zango'],
    'Kebbi': ['Aleiro','Arewa Dandi','Argungu','Augie','Bagudo','Birnin Kebbi','Bunza','Dandi','Fakai','Gwandu','Jega','Kalgo','Koko/Besse','Maiyama','Ngaski','Sakaba','Shanga','Suru','Wasagu/Danko','Yauri','Zuru'],
    'Kogi': ['Adavi','Ajaokuta','Ankpa','Bassa','Dekina','Ibaji','Idah','Igalamela-Odolu','Ijumu','Kabba/Bunu','Kogi','Lokoja','Mopa-Muro','Ofu','Ogori/Magongo','Okehi','Okene','Olamaboro','Omala','Yagba East','Yagba West'],
    'Kwara': ['Asa','Baruten','Edu','Ekiti','Ifelodun','Ilorin East','Ilorin South','Ilorin West','Irepodun','Isin','Kaiama','Moro','Offa','Oke Ero','Oyun','Pategi'],
    'Lagos': ['Agege','Ajeromi-Ifelodun','Alimosho','Amuwo-Odofin','Apapa','Badagry','Epe','Eti-Osa','Ibeju-Lekki','Ifako-Ijaiye','Ikeja','Ikorodu','Kosofe','Lagos Island','Lagos Mainland','Mushin','Ojo','Oshodi-Isolo','Shomolu','Surulere'],
    'Nasarawa': ['Akwanga','Awe','Doma','Karu','Keana','Keffi','Kokona','Lafia','Nasarawa','Nasarawa Egon','Obi','Toto','Wamba'],
    'Niger': ['Agaie','Agwara','Bida','Borgu','Bosso','Chanchaga','Edati','Gbako','Gurara','Katcha','Kontagora','Lapai','Lavun','Magama','Mariga','Mashegu','Mokwa','Moya','Paikoro','Rafi','Rijau','Shiroro','Suleja','Tafa','Wushishi'],
    'Ogun': ['Abeokuta North','Abeokuta South','Ado-Odo/Ota','Ewekoro','Ifo','Ijebu East','Ijebu North','Ijebu North East','Ijebu Ode','Ikenne','Imeko Afon','Ipokia','Obafemi Owode','Odeda','Odogbolu','Ogun Waterside','Remo North','Sagamu','Yewa North','Yewa South'],
    'Ondo': ['Akoko North-East','Akoko North-West','Akoko South-East','Akoko South-West','Akure North','Akure South','Ese-Odo','Idanre','Ifedore','Ilaje','Ile-Oluji/Okeigbo','Irele','Odigbo','Okitipupa','Ondo East','Ondo West','Ose','Owo'],
    'Osun': ['Aiyedaade','Aiyedire','Atakunmosa East','Atakunmosa West','Boluwaduro','Boripe','Ede North','Ede South','Egbedore','Ejigbo','Ife Central','Ife East','Ife North','Ife South','Ifedayo','Ifelodun','Ila','Ilesa East','Ilesa West','Irepodun','Irewole','Isokan','Iwo','Obokun','Odo Otin','Ola Oluwa','Olorunda','Oriade','Orolu','Osogbo'],
    'Oyo': ['Afijio','Akinyele','Atiba','Atisbo','Egbeda','Ibadan North','Ibadan North-East','Ibadan North-West','Ibadan South-East','Ibadan South-West','Ibarapa Central','Ibarapa East','Ibarapa North','Ido','Irepo','Iseyin','Itesiwaju','Iwajowa','Kajola','Lagelu','Ogbomosho North','Ogbomosho South','Ogo Oluwa','Olorunsogo','Oluyole','Ona Ara','Orelope','Ori Ire','Oyo East','Oyo West','Saki East','Saki West','Surulere'],
    'Plateau': ['Barkin Ladi','Bassa','Bokkos','Jos East','Jos North','Jos South','Kanam','Kanke','Langtang North','Langtang South','Mangu','Mikang','Pankshin',"Qua'an Pan",'Riyom','Shendam','Wase'],
    'Rivers': ['Abua/Odual','Ahoada East','Ahoada West','Akuku-Toru','Andoni','Asari-Toru','Bonny','Degema','Eleme','Emohua','Etche','Gokana','Ikwerre','Khana','Obio/Akpor','Ogba/Egbema/Ndoni','Ogu/Bolo','Okrika','Omuma','Opobo/Nkoro','Oyigbo','Port Harcourt','Tai'],
    'Sokoto': ['Binji','Bodinga','Dange Shuni','Gada','Goronyo','Gudu','Gwadabawa','Illela','Isa','Kebbe','Kware','Rabah','Sabon Birni','Shagari','Silame','Sokoto North','Sokoto South','Tambuwal','Tangaza','Tureta','Wamako','Wurno','Yabo'],
    'Taraba': ['Ardo Kola','Bali','Donga','Gashaka','Gassol','Ibi','Jalingo','Karim Lamido','Kumi','Lau','Sardauna','Takum','Ussa','Wukari','Yorro','Zing'],
    'Yobe': ['Bade','Bursari','Damaturu','Fika','Fune','Geidam','Gujba','Gulani','Jakusko','Karasuwa','Machina','Nangere','Nguru','Potiskum','Tarmuwa','Yunusari','Yusufari'],
    'Zamfara': ['Anka','Bakura','Birnin Magaji/Kiyaw','Bukkuyum','Bungudu','Gummi','Gusau','Kaura Namoda','Maradun','Maru','Shinkafi','Talata Mafara','Tsafe','Zurmi'],
  },
};

// ============================================================
// GHANA — 16 regions → ~216 districts
// ============================================================
const GH: SubdivisionData = {
  primary: {
    'Ahafo': ['Asunafo North','Asunafo South','Asutifi North','Asutifi South','Tano North','Tano South'],
    'Ashanti': ['Asokore Mampong','Asokwa','Atwima Kwanwoma','Atwima Mponua','Atwima Nwabiagya','Bekwai','Bosome Freho','Bosomtwe','Ejisu-Juaben','Ejura Sekyedumase','Kumasi Metropolitan','Kwabre East','Kwadaso','Mampong','Obuasi East','Obuasi Municipal','Offinso Municipal','Offinso North','Old Tafo','Sekyere Afram Plains North','Sekyere Afram Plains South','Sekyere Central','Sekyere East','Sekyere Kumawu','Sekyere South','Suame'],
    'Bono': ['Banda','Berekum East','Berekum West','Dormaa Central','Dormaa East','Dormaa West','Jaman North','Jaman South','Sunyani Municipal','Sunyani West','Tain','Wenchi'],
    'Bono East': ['Atebubu-Amantin','Kintampo North','Kintampo South','Nkoranza North','Nkoranza South','Pru East','Pru West','Sene East','Sene West','Techiman Municipal','Techiman North'],
    'Central': ['Abura-Asebu-Kwamankese','Agona East','Agona West','Ajumako-Enyan-Essiam','Asikuma-Odoben-Brakwa','Assin Central','Assin North','Assin South','Awutu Senya East','Awutu Senya West','Cape Coast Metropolitan','Effutu','Ekumfi','Gomoa Central','Gomoa East','Gomoa West','Komenda-Edina-Eguafo-Abirem','Mfantsiman','Twifo-Ati Morkwa','Upper Denkyira East','Upper Denkyira West'],
    'Eastern': ['Abuakwa North','Abuakwa South','Achiase','Afigya Kwabre','Akyemansa','Asuogyaman','Atiwa East','Atiwa West','Ayensuano','Birim Central','Birim North','Birim South','Denkyembour','Fanteakwa North','Fanteakwa South','Kwaebibirem','Kwahu Afram Plains North','Kwahu Afram Plains South','Kwahu East','Kwahu South','Kwahu West','Lower Manya Krobo','New Juaben North','New Juaben South','Nsawam Adoagyiri','Okere','Suhum','Upper Manya Krobo','Upper West Akim','West Akim','Yilo Krobo'],
    'Greater Accra': ['Ablekuma Central','Ablekuma North','Ablekuma West','Accra Metropolitan','Ada East','Ada West','Adentan','Ashaiman','Ayawaso Central','Ayawaso East','Ayawaso North','Ayawaso West','Ga Central','Ga East','Ga North','Ga South','Ga West','Korle Klottey','Kpone-Katamanso','Krowor','La Dade-Kotopon','La Nkwantanang-Madina','Ledzokuku','Ningo-Prampram','Okaikwei North','Shai-Osudoku','Tema Metropolitan','Tema West','Weija-Gbawe'],
    'North East': ['Bunkpurugu-Nakpanduri','Chereponi','East Mamprusi','Mamprugu-Moagduri','West Mamprusi','Yunyoo-Nasuan'],
    'Northern': ['Gushegu','Karaga','Kpandai','Kumbungu','Mion','Nanton','Nanumba North','Nanumba South','Saboba','Sagnarigu','Savelugu','Tatale-Sanguli','Tolon','Yendi','Zabzugu'],
    'Oti': ['Biakoye','Guan','Jasikan','Kadjebi','Krachi East','Krachi Nchumuru','Krachi West','Nkwanta North','Nkwanta South'],
    'Savannah': ['Bole','Central Gonja','East Gonja','North East Gonja','North Gonja','Sawla-Tuna-Kalba','West Gonja'],
    'Upper East': ['Bawku Municipal','Bawku West','Binduri','Bolgatanga East','Bolgatanga Municipal','Bongo','Builsa North','Builsa South','Garu','Kassena-Nankana East','Kassena-Nankana West','Nabdam','Pusiga','Talensi','Tempane'],
    'Upper West': ['Daffiama-Bussie-Issa','Jirapa','Lambussie Karni','Lawra','Nadowli-Kaleo','Nandom','Sissala East','Sissala West','Wa East','Wa Municipal','Wa West'],
    'Volta': ['Adaklu','Afadzato South','Agotime-Ziope','Akatsi North','Akatsi South','Anloga','Central Tongu','Ho Municipal','Ho West','Hohoe','Keta Municipal','Ketu North','Ketu South','Kpando','North Dayi','North Tongu','South Dayi','South Tongu'],
    'Western': ['Ahanta West','Effia Kwesimintsim','Ellembelle','Jomoro','Mpohor','Nzema East','Prestea-Huni Valley','Sekondi-Takoradi','Shama','Tarkwa-Nsuaem','Wassa Amenfi Central','Wassa Amenfi East','Wassa Amenfi West','Wassa East'],
    'Western North': ['Aowin','Bia East','Bia West','Bibiani-Anhwiaso-Bekwai','Bodi','Juaboso','Sefwi Akontombra','Sefwi Wiawso','Suaman'],
  },
};

// ============================================================
// KENYA — 47 counties (single level, no secondary)
// ============================================================
const KE: SubdivisionData = {
  primary: {
    'Baringo': [], 'Bomet': [], 'Bungoma': [], 'Busia': [], 'Elgeyo-Marakwet': [],
    'Embu': [], 'Garissa': [], 'Homa Bay': [], 'Isiolo': [], 'Kajiado': [],
    'Kakamega': [], 'Kericho': [], 'Kiambu': [], 'Kilifi': [], 'Kirinyaga': [],
    'Kisii': [], 'Kisumu': [], 'Kitui': [], 'Kwale': [], 'Laikipia': [],
    'Lamu': [], 'Machakos': [], 'Makueni': [], 'Mandera': [], 'Marsabit': [],
    'Meru': [], 'Migori': [], 'Mombasa': [], 'Muranga': [], 'Nairobi': [],
    'Nakuru': [], 'Nandi': [], 'Narok': [], 'Nyamira': [], 'Nyandarua': [],
    'Nyeri': [], 'Samburu': [], 'Siaya': [], 'Taita-Taveta': [], 'Tana River': [],
    'Tharaka-Nithi': [], 'Trans Nzoia': [], 'Turkana': [], 'Uasin Gishu': [],
    'Vihiga': [], 'Wajir': [], 'West Pokot': [],
  },
};

// ============================================================
// EXPORTS
// ============================================================
export const SUBDIVISIONS: Record<string, SubdivisionData> = {
  NG, GH, KE,
};

export function hasPrimarySubdivisions(countryCode: string): boolean {
  return !!SUBDIVISIONS[countryCode];
}

export function getPrimaryOptions(countryCode: string): string[] {
  const d = SUBDIVISIONS[countryCode];
  if (!d) return [];
  return Object.keys(d.primary).sort();
}

export function getSecondaryOptions(countryCode: string, primary: string): string[] {
  const d = SUBDIVISIONS[countryCode];
  if (!d) return [];
  return (d.primary[primary] || []).slice().sort();
}
