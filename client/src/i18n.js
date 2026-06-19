import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {

      en: {
  translation: {
    hello: "Hello",
    youAreIn: "You're in",
    detectingLocation: "Detecting your location...",
    popularPlaces: "Most Popular Places",

    dashboard: "Dashboard",
    explore: "Explore",
    itinerary: "Itinerary",
    myTrips: "My Trips",
    saved: "Saved",
    profile: "Profile",
    logout: "Logout",

    addLocation: "Add Your Current Location",
    localSuggestions: "Get local suggestions",

    budgetTrip: "Plan a Trip in Budget",
    findDeals: "Find best deals",

    chatSarathi: "Chat with Sarathi",
    aiAssistant: "AI Assistant",

    planDay: "Plan Your Day",
    buildItinerary: "Build itinerary",

    nextAdventure: "Your Next Adventure Awaits",
    discover: "Discover the unexplored",
    recommendations: "AI-powered recommendations just for you.",
    explorePlaces: "Explore Places",

    dayPlanner: "Plan Your Day",
    generate: "Generate My Day",
    summary: "Day Summary",
    placesCovered: "Places Covered",
    estimatedCost: "Estimated Cost",
    todayPlan: "Today's Plan",

    searchDestinations: "Search destinations...",

    india: "India",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    night: "Night",

    navigate: "Navigate",
    language: "Language",

    welcome: "Welcome to Sarathi",
    currentLocation: "Current Location",

    enableLocation: "Enable Location to Explore",
showingResults: "Showing results near you",
places: "Places",
food: "Food",
hotels: "Hotels",
topRestaurants: "Top Restaurants",
bestHotels: "Best Hotels",
loading: "Loading..."
  }
},



    te: {
  translation: {
    hello: "హలో",
    youAreIn: "మీరు ఉన్న ప్రదేశం",
    detectingLocation: "మీ స్థానం గుర్తిస్తోంది...",
    popularPlaces: "ప్రసిద్ధ ప్రదేశాలు",

    dashboard: "డాష్‌బోర్డ్",
    explore: "అన్వేషించండి",
    itinerary: "ప్రయాణ ప్రణాళిక",
    myTrips: "నా ప్రయాణాలు",
    saved: "సేవ్ చేసినవి",
    profile: "ప్రొఫైల్",
    logout: "లాగ్ అవుట్",

    addLocation: "మీ ప్రస్తుత స్థానాన్ని జోడించండి",
    localSuggestions: "స్థానిక సూచనలు పొందండి",

    budgetTrip: "బడ్జెట్‌లో ట్రిప్ ప్లాన్ చేయండి",
    findDeals: "ఉత్తమ ఆఫర్లు కనుగొనండి",

    chatSarathi: "సారథితో చాట్ చేయండి",
    aiAssistant: "ఏఐ సహాయకుడు",

    planDay: "మీ రోజును ప్లాన్ చేయండి",
    buildItinerary: "ప్రయాణ ప్రణాళిక రూపొందించండి",

    nextAdventure: "మీ తదుపరి సాహసం ఎదురుచూస్తోంది",
    discover: "తెలియని ప్రదేశాలను కనుగొనండి",
    recommendations: "మీ కోసం AI సూచనలు",
    explorePlaces: "ప్రదేశాలను అన్వేషించండి",

    dayPlanner: "మీ రోజును ప్లాన్ చేయండి",
    generate: "నా రోజును రూపొందించు",
    summary: "రోజు సారాంశం",
    placesCovered: "సందర్శించిన ప్రదేశాలు",
    estimatedCost: "అంచనా ఖర్చు",
    todayPlan: "ఈరోజు ప్రణాళిక",

    searchDestinations: "ప్రదేశాలను వెతకండి...",

    india: "భారతదేశం",
    morning: "ఉదయం",
    afternoon: "మధ్యాహ్నం",
    evening: "సాయంత్రం",
    night: "రాత్రి",

    navigate: "మార్గనిర్దేశం",
    language: "భాష",

    welcome: "సారథికి స్వాగతం",
    currentLocation: "ప్రస్తుత స్థానం",
    loading: "లోడ్ అవుతోంది...",
    enableLocation:
  "అన్వేషించడానికి స్థానాన్ని ప్రారంభించండి",

showingResults:
  "మీ సమీపంలోని ఫలితాలు",

places: "ప్రదేశాలు",

food: "ఆహారం",

hotels: "హోటళ్ళు",

topRestaurants:
  "ఉత్తమ రెస్టారెంట్లు",

bestHotels:
  "ఉత్తమ హోటళ్ళు",

  }
},

      hi: {
  translation: {
    hello: "नमस्ते",
    youAreIn: "आप यहाँ हैं",
    detectingLocation: "आपकी लोकेशन पता की जा रही है...",
    popularPlaces: "लोकप्रिय स्थान",

    dashboard: "डैशबोर्ड",
    explore: "खोजें",
    itinerary: "यात्रा योजना",
    myTrips: "मेरी यात्राएँ",
    saved: "सहेजे गए",
    profile: "प्रोफ़ाइल",
    logout: "लॉगआउट",

    addLocation: "अपना वर्तमान स्थान जोड़ें",
    localSuggestions: "स्थानीय सुझाव प्राप्त करें",

    budgetTrip: "बजट में यात्रा की योजना बनाएं",
    findDeals: "सर्वश्रेष्ठ ऑफर खोजें",

    chatSarathi: "सारथी से चैट करें",
    aiAssistant: "एआई सहायक",

    planDay: "अपने दिन की योजना बनाएं",
    buildItinerary: "यात्रा योजना बनाएं",

    nextAdventure: "आपका अगला साहसिक इंतजार कर रहा है",
    discover: "अनदेखी जगहों की खोज करें",
    recommendations: "आपके लिए AI सुझाव",
    explorePlaces: "स्थान खोजें",

    dayPlanner: "अपने दिन की योजना बनाएं",
    generate: "मेरा दिन बनाएं",
    summary: "दिन का सारांश",
    placesCovered: "देखी गई जगहें",
    estimatedCost: "अनुमानित लागत",
    todayPlan: "आज की योजना",

    searchDestinations: "स्थानों को खोजें...",

    india: "भारत",
    morning: "सुबह",
    afternoon: "दोपहर",
    evening: "शाम",
    night: "रात",

    navigate: "नेविगेट करें",
    language: "भाषा",

    welcome: "सारथी में आपका स्वागत है",
    currentLocation: "वर्तमान स्थान",
    loading: "लोड हो रहा है...",

    enableLocation:
  "खोजने के लिए लोकेशन सक्षम करें",

showingResults:
  "आपके आसपास के परिणाम",

places: "स्थान",

food: "भोजन",

hotels: "होटल",

topRestaurants:
  "सर्वश्रेष्ठ रेस्टोरेंट",

bestHotels:
  "सर्वश्रेष्ठ होटल",

  }
}

    },

    fallbackLng: "en",

    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
