/* ============================================================================
   MBU ADMIN / a verse or hadith for the day, and Mashallah by the money
   ----------------------------------------------------------------------------
   Shown on Home above the money, and at the top of Insights -> Sold. One a
   day, the same on both phones, changing at midnight. The Qur'an and the
   hadith take turns, and every card says which it is.

   WHERE THE WORDS COME FROM. None of the Arabic was typed by hand.
     Qur'an:  the Uthmani text from Tanzil (via api.alquran.cloud), English
              from Saheeh International. Where only part of a verse is
              quoted it is cut at one of the Qur'an's own pause marks and
              marked "(part)".
     Hadith:  the Arabic and English as published on sunnah.com (via the open
              fawazahmed0/hadith-api dataset), numbered the way sunnah.com
              numbers them, so every "link" opens the same hadith there. Only
              the Prophet's words are shown, not the chain of narrators.
              Only hadith graded sahih or hasan; the grade is shown for the
              collections outside Bukhari and Muslim.
     One English correction: the dataset's translation of Ibn Majah 3509 says
     "They said" where the Arabic says qāla, "He said" (the Prophet). It
     follows the Arabic here.

   TO ADD ONE: copy the Arabic from quran.com or sunnah.com, never retype it,
   and give it a link so anyone can check it. `kind` is 'quran' or 'hadith'.
   ========================================================================== */
window.MBU_VERSES = {
  "mashallah": {
    "ar": "مَا شَآءَ ٱللَّهُ · بَارَكَ ٱللَّهُ",
    "en": "Mashallah · Barakallah",
    "meaning": "What Allah has willed · May Allah bless it"
  },
  "list": [
    {
      "kind": "quran",
      "ar": "وَإِذْ تَأَذَّنَ رَبُّكُمْ لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ",
      "en": "And [remember] when your Lord proclaimed, 'If you are grateful, I will surely increase you [in favor]…'",
      "ref": "Ibrahim 14:7 (part)",
      "link": "https://quran.com/14/7",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "فَإِنْ صَدَقَا وَبَيَّنَا بُورِكَ لَهُمَا فِي بَيْعِهِمَا، وَإِنْ كَتَمَا وَكَذَبَا مُحِقَتْ بَرَكَةُ بَيْعِهِمَا",
      "en": "If both the parties spoke the truth and described the defects and qualities (of the goods), then they would be blessed in their transaction, and if they told lies or hid something, then the blessings of their transaction would be lost.",
      "intro": "The Prophet ﷺ said, about the buyer and the seller:",
      "ref": "Sahih al-Bukhari 2079 (part)",
      "link": "https://sunnah.com/bukhari:2079",
      "source": ""
    },
    {
      "kind": "quran",
      "ar": "وَلَوْلَآ إِذْ دَخَلْتَ جَنَّتَكَ قُلْتَ مَا شَآءَ ٱللَّهُ لَا قُوَّةَ إِلَّا بِٱللَّهِ",
      "en": "And why did you, when you entered your garden, not say, 'What Allah willed [has occurred]; there is no power except in Allah'?",
      "ref": "Al-Kahf 18:39 (part)",
      "link": "https://quran.com/18/39",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "رَحِمَ اللَّهُ رَجُلاً سَمْحًا إِذَا بَاعَ، وَإِذَا اشْتَرَى، وَإِذَا اقْتَضَى",
      "en": "May Allah's mercy be on him who is lenient in his buying, selling, and in demanding back his money.",
      "intro": "The Prophet ﷺ said:",
      "ref": "Sahih al-Bukhari 2076",
      "link": "https://sunnah.com/bukhari:2076",
      "source": ""
    },
    {
      "kind": "quran",
      "ar": "وَمَن يَتَّقِ ٱللَّهَ يَجْعَل لَّهُۥ مَخْرَجًۭا ۝٢ وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ ۚ وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥٓ ۝٣",
      "en": "And whoever fears Allah – He will make for him a way out, and will provide for him from where he does not expect. And whoever relies upon Allah – then He is sufficient for him.",
      "ref": "At-Talaq 65:2-3 (part)",
      "link": "https://quran.com/65/2-3",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "لَيْسَ الْغِنَى عَنْ كَثْرَةِ الْعَرَضِ، وَلَكِنَّ الْغِنَى غِنَى النَّفْسِ",
      "en": "Wealth is not in having many possessions, but rather (true) wealth is feeling sufficiency in the soul.",
      "intro": "The Prophet ﷺ said:",
      "ref": "Sahih al-Bukhari 6446",
      "link": "https://sunnah.com/bukhari:6446",
      "source": ""
    },
    {
      "kind": "quran",
      "ar": "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا ۝٥ إِنَّ مَعَ ٱلْعُسْرِ يُسْرًۭا ۝٦",
      "en": "For indeed, with hardship [will be] ease. Indeed, with hardship [will be] ease.",
      "ref": "Ash-Sharh 94:5-6",
      "link": "https://quran.com/94/5-6",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "مَا أَكَلَ أَحَدٌ طَعَامًا قَطُّ خَيْرًا مِنْ أَنْ يَأْكُلَ مِنْ عَمَلِ يَدِهِ، وَإِنَّ نَبِيَّ اللَّهِ دَاوُدَ ـ عَلَيْهِ السَّلاَمُ ـ كَانَ يَأْكُلُ مِنْ عَمَلِ يَدِهِ",
      "en": "Nobody has ever eaten a better meal than that which one has earned by working with one's own hands. The Prophet of Allah, David, used to eat from the earnings of his manual labour.",
      "intro": "The Prophet ﷺ said:",
      "ref": "Sahih al-Bukhari 2072",
      "link": "https://sunnah.com/bukhari:2072",
      "source": ""
    },
    {
      "kind": "quran",
      "ar": "وَأَوْفُوا۟ ٱلْكَيْلَ إِذَا كِلْتُمْ وَزِنُوا۟ بِٱلْقِسْطَاسِ ٱلْمُسْتَقِيمِ ۚ ذَٰلِكَ خَيْرٌۭ وَأَحْسَنُ تَأْوِيلًۭا",
      "en": "And give full measure when you measure, and weigh with an even balance. That is the best [way] and best in result.",
      "ref": "Al-Isra 17:35",
      "link": "https://quran.com/17/35",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "وَأَنَّ أَحَبَّ الأَعْمَالِ أَدْوَمُهَا إِلَى اللَّهِ، وَإِنْ قَلَّ",
      "en": "…the most beloved deed to Allah is the most regular and constant, even if it were little.",
      "intro": "The Prophet ﷺ said:",
      "ref": "Sahih al-Bukhari 6464 (part)",
      "link": "https://sunnah.com/bukhari:6464",
      "source": ""
    },
    {
      "kind": "quran",
      "ar": "يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ لَا تَأْكُلُوٓا۟ أَمْوَٰلَكُم بَيْنَكُم بِٱلْبَٰطِلِ إِلَّآ أَن تَكُونَ تِجَٰرَةً عَن تَرَاضٍۢ مِّنكُمْ",
      "en": "O you who have believed, do not consume one another's wealth unjustly but only [in lawful] business by mutual consent.",
      "ref": "An-Nisa 4:29 (part)",
      "link": "https://quran.com/4/29",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "مَنْ سَرَّهُ أَنْ يُبْسَطَ لَهُ رِزْقُهُ أَوْ يُنْسَأَ لَهُ فِي أَثَرِهِ فَلْيَصِلْ رَحِمَهُ",
      "en": "Whoever desires an expansion in his sustenance and age should keep good relations with his kith and kin.",
      "intro": "The Prophet ﷺ said:",
      "ref": "Sahih al-Bukhari 2067",
      "link": "https://sunnah.com/bukhari:2067",
      "source": ""
    },
    {
      "kind": "quran",
      "ar": "فَإِذَا قُضِيَتِ ٱلصَّلَوٰةُ فَٱنتَشِرُوا۟ فِى ٱلْأَرْضِ وَٱبْتَغُوا۟ مِن فَضْلِ ٱللَّهِ وَٱذْكُرُوا۟ ٱللَّهَ كَثِيرًۭا لَّعَلَّكُمْ تُفْلِحُونَ",
      "en": "And when the prayer has been concluded, disperse within the land and seek from the bounty of Allah, and remember Allah often that you may succeed.",
      "ref": "Al-Jumu'ah 62:10",
      "link": "https://quran.com/62/10",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "الْيَدُ الْعُلْيَا خَيْرٌ مِنَ الْيَدِ السُّفْلَى، فَالْيَدُ الْعُلْيَا هِيَ الْمُنْفِقَةُ، وَالسُّفْلَى هِيَ السَّائِلَةُ",
      "en": "The upper hand is better than the lower hand. The upper hand is that of the giver and the lower (hand) is that of the beggar.",
      "intro": "The Prophet ﷺ said:",
      "ref": "Sahih al-Bukhari 1429",
      "link": "https://sunnah.com/bukhari:1429",
      "source": ""
    },
    {
      "kind": "quran",
      "ar": "وَمَا مِن دَآبَّةٍۢ فِى ٱلْأَرْضِ إِلَّا عَلَى ٱللَّهِ رِزْقُهَا وَيَعْلَمُ مُسْتَقَرَّهَا وَمُسْتَوْدَعَهَا",
      "en": "And there is no creature on earth but that upon Allah is its provision, and He knows its place of dwelling and place of storage.",
      "ref": "Hud 11:6 (part)",
      "link": "https://quran.com/11/6",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "أَفَلاَ جَعَلْتَهُ فَوْقَ الطَّعَامِ كَىْ يَرَاهُ النَّاسُ مَنْ غَشَّ فَلَيْسَ مِنِّي",
      "en": "Why did you not place this (the wet part) over the rest of the food so that the people could see it? He who deceives is not of me.",
      "intro": "The Prophet ﷺ said, finding a pile of food wet underneath:",
      "ref": "Sahih Muslim 102 (part)",
      "link": "https://sunnah.com/muslim:102",
      "source": ""
    },
    {
      "kind": "quran",
      "ar": "وَلَا تُصَعِّرْ خَدَّكَ لِلنَّاسِ وَلَا تَمْشِ فِى ٱلْأَرْضِ مَرَحًا ۖ إِنَّ ٱللَّهَ لَا يُحِبُّ كُلَّ مُخْتَالٍۢ فَخُورٍۢ",
      "en": "And do not turn your cheek [in contempt] toward people and do not walk through the earth exultantly. Indeed, Allah does not like everyone self-deluded and boastful.",
      "ref": "Luqman 31:18",
      "link": "https://quran.com/31/18",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "مَا نَقَصَتْ صَدَقَةٌ مِنْ مَالٍ وَمَا زَادَ اللَّهُ عَبْدًا بِعَفْوٍ إِلاَّ عِزًّا وَمَا تَوَاضَعَ أَحَدٌ لِلَّهِ إِلاَّ رَفَعَهُ اللَّهُ",
      "en": "Charity does not decrease wealth, no one forgives another except that Allah increases his honour, and no one humbles himself for the sake of Allah except that Allah raises his status.",
      "intro": "The Prophet ﷺ said:",
      "ref": "Sahih Muslim 2588",
      "link": "https://sunnah.com/muslim:2588",
      "source": ""
    },
    {
      "kind": "quran",
      "ar": "وَٱبْتَغِ فِيمَآ ءَاتَىٰكَ ٱللَّهُ ٱلدَّارَ ٱلْءَاخِرَةَ ۖ وَلَا تَنسَ نَصِيبَكَ مِنَ ٱلدُّنْيَا ۖ وَأَحْسِن كَمَآ أَحْسَنَ ٱللَّهُ إِلَيْكَ",
      "en": "But seek, through that which Allah has given you, the home of the Hereafter; and [yet], do not forget your share of the world. And do good as Allah has done good to you.",
      "ref": "Al-Qasas 28:77 (part)",
      "link": "https://quran.com/28/77",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "انْظُرُوا إِلَى مَنْ أَسْفَلَ مِنْكُمْ وَلاَ تَنْظُرُوا إِلَى مَنْ هُوَ فَوْقَكُمْ فَهُوَ أَجْدَرُ أَنْ لاَ تَزْدَرُوا نِعْمَةَ اللَّهِ",
      "en": "Look at those who stand at a lower level than you, and don't look at those who stand at a higher level than you, for that is better suited so that you do not disparage Allah's favours.",
      "intro": "The Prophet ﷺ said:",
      "ref": "Sahih Muslim 2963",
      "link": "https://sunnah.com/muslim:2963c",
      "source": ""
    },
    {
      "kind": "quran",
      "ar": "فَٱعْفُ عَنْهُمْ وَٱسْتَغْفِرْ لَهُمْ وَشَاوِرْهُمْ فِى ٱلْأَمْرِ ۖ فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى ٱللَّهِ ۚ إِنَّ ٱللَّهَ يُحِبُّ ٱلْمُتَوَكِّلِينَ",
      "en": "So pardon them and ask forgiveness for them and consult them in the matter. And when you have decided, then rely upon Allah. Indeed, Allah loves those who rely [upon Him].",
      "ref": "Al Imran 3:159 (part)",
      "link": "https://quran.com/3/159",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "عَجَبًا لأَمْرِ الْمُؤْمِنِ إِنَّ أَمْرَهُ كُلَّهُ خَيْرٌ وَلَيْسَ ذَاكَ لأَحَدٍ إِلاَّ لِلْمُؤْمِنِ إِنْ أَصَابَتْهُ سَرَّاءُ شَكَرَ فَكَانَ خَيْرًا لَهُ وَإِنْ أَصَابَتْهُ ضَرَّاءُ صَبَرَ فَكَانَ خَيْرًا لَهُ",
      "en": "Strange are the ways of a believer, for there is good in every affair of his. If he has an occasion to feel delight, he thanks (Allah), and there is good for him in it; and if he gets into trouble and endures it patiently, there is good for him in it.",
      "intro": "The Prophet ﷺ said:",
      "ref": "Sahih Muslim 2999",
      "link": "https://sunnah.com/muslim:2999",
      "source": ""
    },
    {
      "kind": "quran",
      "ar": "يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوٓا۟ أَوْفُوا۟ بِٱلْعُقُودِ",
      "en": "O you who have believed, fulfill [all] contracts.",
      "ref": "Al-Ma'idah 5:1 (part)",
      "link": "https://quran.com/5/1",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "لَوْ أَنَّكُمْ كُنْتُمْ تَوَكَّلُونَ عَلَى اللَّهِ حَقَّ تَوَكُّلِهِ لَرُزِقْتُمْ كَمَا تُرْزَقُ الطَّيْرُ تَغْدُو خِمَاصًا وَتَرُوحُ بِطَانًا",
      "en": "If you were to rely upon Allah with the required reliance, then He would provide for you just as a bird is provided for: it goes out in the morning empty, and returns full.",
      "intro": "The Prophet ﷺ said:",
      "ref": "Jami' at-Tirmidhi 2344",
      "link": "https://sunnah.com/tirmidhi:2344",
      "source": "Sahih (al-Albani)"
    },
    {
      "kind": "quran",
      "ar": "فَٱذْكُرُونِىٓ أَذْكُرْكُمْ وَٱشْكُرُوا۟ لِى وَلَا تَكْفُرُونِ",
      "en": "So remember Me; I will remember you. And be grateful to Me and do not deny Me.",
      "ref": "Al-Baqarah 2:152",
      "link": "https://quran.com/2/152",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "يَا رَسُولَ اللَّهِ أَعْقِلُهَا وَأَتَوَكَّلُ أَوْ أُطْلِقُهَا وَأَتَوَكَّلُ قَالَ اعْقِلْهَا وَتَوَكَّلْ",
      "en": "“O Messenger of Allah! Shall I tie it (my camel) and rely upon Allah, or leave it loose and rely upon Allah?” He said: “Tie it and rely upon Allah.”",
      "intro": "A man asked the Prophet ﷺ:",
      "ref": "Jami' at-Tirmidhi 2517",
      "link": "https://sunnah.com/tirmidhi:2517",
      "source": "Hasan (al-Albani)"
    },
    {
      "kind": "quran",
      "ar": "وَإِن تَعُدُّوا۟ نِعْمَةَ ٱللَّهِ لَا تُحْصُوهَآ ۗ إِنَّ ٱللَّهَ لَغَفُورٌۭ رَّحِيمٌۭ",
      "en": "And if you should count the favors of Allah, you could not enumerate them. Indeed, Allah is Forgiving and Merciful.",
      "ref": "An-Nahl 16:18",
      "link": "https://quran.com/16/18",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "لاَ يَشْكُرُ اللَّهَ مَنْ لاَ يَشْكُرُ النَّاسَ",
      "en": "He who does not thank the people is not thankful to Allah.",
      "intro": "The Prophet ﷺ said:",
      "ref": "Sunan Abi Dawud 4811",
      "link": "https://sunnah.com/abudawud:4811",
      "source": "Sahih (al-Albani)"
    },
    {
      "kind": "quran",
      "ar": "وَأَمَّا بِنِعْمَةِ رَبِّكَ فَحَدِّثْ",
      "en": "But as for the favor of your Lord, report [it].",
      "ref": "Ad-Duha 93:11",
      "link": "https://quran.com/93/11",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "عَلاَمَ يَقْتُلُ أَحَدُكُمْ أَخَاهُ إِذَا رَأَى أَحَدُكُمْ مِنْ أَخِيهِ مَا يُعْجِبُهُ فَلْيَدْعُ لَهُ بِالْبَرَكَةِ",
      "en": "Why would one of you kill his brother? If one of you sees something in his brother that he likes, let him pray for blessing for him.",
      "intro": "The Prophet ﷺ said, about the evil eye:",
      "ref": "Sunan Ibn Majah 3509 (part)",
      "link": "https://sunnah.com/ibnmajah:3509",
      "source": "Sahih (al-Albani)"
    },
    {
      "kind": "quran",
      "ar": "لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
      "en": "Allah does not charge a soul except [with that within] its capacity.",
      "ref": "Al-Baqarah 2:286 (part)",
      "link": "https://quran.com/2/286",
      "source": "Saheeh International"
    },
    {
      "kind": "hadith",
      "ar": "الْمُسْلِمُ أَخُو الْمُسْلِمِ وَلاَ يَحِلُّ لِمُسْلِمٍ بَاعَ مِنْ أَخِيهِ بَيْعًا فِيهِ عَيْبٌ إِلاَّ بَيَّنَهُ لَهُ",
      "en": "The Muslim is the brother of another Muslim, and it is not permissible for a Muslim to sell his brother goods in which there is a defect, without pointing that out to him.",
      "intro": "The Prophet ﷺ said:",
      "ref": "Sunan Ibn Majah 2246",
      "link": "https://sunnah.com/ibnmajah:2246",
      "source": "Sahih (al-Albani)"
    },
    {
      "kind": "quran",
      "ar": "وَيْلٌۭ لِّلْمُطَفِّفِينَ ۝١ ٱلَّذِينَ إِذَا ٱكْتَالُوا۟ عَلَى ٱلنَّاسِ يَسْتَوْفُونَ ۝٢ وَإِذَا كَالُوهُمْ أَو وَّزَنُوهُمْ يُخْسِرُونَ ۝٣",
      "en": "Woe to those who give less [than due], who, when they take a measure from people, take in full. But if they give by measure or by weight to them, they cause loss.",
      "ref": "Al-Mutaffifin 83:1-3",
      "link": "https://quran.com/83/1-3",
      "source": "Saheeh International"
    },
    {
      "kind": "quran",
      "ar": "لِّكَيْلَا تَأْسَوْا۟ عَلَىٰ مَا فَاتَكُمْ وَلَا تَفْرَحُوا۟ بِمَآ ءَاتَىٰكُمْ ۗ وَٱللَّهُ لَا يُحِبُّ كُلَّ مُخْتَالٍۢ فَخُورٍ",
      "en": "In order that you not despair over what has eluded you and not exult [in pride] over what He has given you. And Allah does not like everyone self-deluded and boastful.",
      "ref": "Al-Hadid 57:23",
      "link": "https://quran.com/57/23",
      "source": "Saheeh International"
    },
    {
      "kind": "quran",
      "ar": "وَمَآ أَنفَقْتُم مِّن شَىْءٍۢ فَهُوَ يُخْلِفُهُۥ ۖ وَهُوَ خَيْرُ ٱلرَّٰزِقِينَ",
      "en": "But whatever thing you spend [in His cause] – He will compensate it; and He is the best of providers.",
      "ref": "Saba 34:39 (part)",
      "link": "https://quran.com/34/39",
      "source": "Saheeh International"
    },
    {
      "kind": "quran",
      "ar": "فَبِأَىِّ ءَالَآءِ رَبِّكُمَا تُكَذِّبَانِ",
      "en": "So which of the favors of your Lord would you deny?",
      "ref": "Ar-Rahman 55:13",
      "link": "https://quran.com/55/13",
      "source": "Saheeh International"
    }
  ]
};
