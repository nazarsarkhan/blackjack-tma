import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const LANGUAGE_STORAGE_KEY = "blackjack-mini-app-language";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "ru", label: "Russian", nativeLabel: "Русский" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português" },
  { code: "tr", label: "Turkish", nativeLabel: "Türkçe" },
  { code: "fa", label: "Persian", nativeLabel: "فارسی" },
  { code: "hi", label: "Hindi", nativeLabel: "हिंदी" },
  { code: "zh", label: "Chinese", nativeLabel: "中文" },
  { code: "id", label: "Indonesian", nativeLabel: "Bahasa Indonesia" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "it", label: "Italian", nativeLabel: "Italiano" },
  { code: "ko", label: "Korean", nativeLabel: "한국어" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語" }
];

const resources = {
  en: {
    translation: {
      screens: { lobby: "Lobby", table: "Table", history: "History", shop: "Chips", settings: "Settings" },
      loading: { connecting: "Connecting to the table..." },
      topbar: {
        eyebrow: "Telegram Mini App",
        subtitle: "Green felt, fast rounds, and casino-style house edge.",
        guest: "Guest",
        soundOn: "Sound On",
        soundOff: "Sound Off",
        live: "LIVE",
        demo: "DEMO"
      },
      nav: { aria: "Navigation" },
      lobby: {
        eyebrow: "Lobby",
        title: "Take a seat and launch a quick deal",
        description: "Blackjack pays 3:2, dealer hits soft 17, game history and chip shop are built into the Mini App.",
        startRound: "Start Deal",
        currentTable: "Go to Current Table",
        history: "Game History",
        balance: "Balance",
        rounds: "Rounds",
        wins: "Wins",
        pushes: "Pushes",
        lastGame: "Last Game",
        totalWagered: "Total Wagered"
      },
      table: {
        bet: "Bet",
        player: "Player",
        rules: "Rules",
        deck: "Deck",
        dealerHitsSoft17: "Dealer hits soft 17",
        cards: "cards",
        dealer: "Dealer",
        casino: "Casino",
        yourTable: "Table",
        ready: "Ready to deal",
        roundClosed: "Round closed",
        yourTurn: "Your turn",
        controls: "Controls",
        selectBet: "Pick a bet and start a new round",
        quickActions: "Hit, Stand, or Double right inside the Mini App",
        inPlay: "In play"
      },
      actions: {
        deal: "Deal",
        redeal: "Redeal",
        hit: "Hit",
        stand: "Stand",
        double: "Double",
        split: "Split",
        surrender: "Surrender"
      },
      history: {
        eyebrow: "History",
        title: "Recent Deals",
        refresh: "Refresh",
        emptyTitle: "Nothing here yet",
        emptyDescription: "Play your first deal and the history will appear here.",
        bet: "Bet",
        payout: "Payout"
      },
      shop: {
        eyebrow: "Shop",
        title: "Chip packs for Telegram Stars",
        note: "The UI is ready. Backend payments can be connected to these packs without reworking the screen.",
        select: "Choose",
        stars: "Stars",
        packs: {
          bronze: "Bronze Stack",
          silver: "Silver Stack",
          gold: "Gold Vault",
          vip: "Platinum Room"
        }
      },
      settings: {
        eyebrow: "Settings",
        title: "Language and app preferences",
        description: "The app detects Telegram language automatically. You can override it here at any time.",
        language: "Language",
        current: "Current language",
        autoDetected: "Auto-detected from Telegram",
        manual: "Manual selection saved on this device"
      },
      results: {
        player_win: "Win",
        player_blackjack: "Blackjack 3:2",
        dealer_win: "Lose",
        dealer_blackjack: "Dealer Blackjack",
        push: "Push"
      },
      outcomes: { win: "Win", lose: "Lose", blackjack: "Blackjack", bust: "Bust", push: "Push" },
      common: {
        chips: "chips",
        noGames: "No games",
        seatFallback: "Seat 1"
      },
      toasts: {
        socketError: "Socket error",
        shopUnavailable: "Telegram Stars purchases are ready for backend integration",
        packPrepared: "{{title}} is prepared for Telegram Stars integration"
      },
      mainButton: {
        newRound: "New Deal",
        stand: "Stand",
        takeSeat: "Take a Seat",
        openShop: "Open Shop",
        toTable: "To Table"
      }
    }
  },
  ru: {
    translation: {
      screens: { lobby: "Лобби", table: "Стол", history: "История", shop: "Фишки", settings: "Настройки" },
      loading: { connecting: "Подключаемся к столу..." },
      topbar: {
        eyebrow: "Telegram Mini App",
        subtitle: "Зелёное сукно, быстрые раунды и house edge по казино-правилам.",
        guest: "Гость",
        soundOn: "Звук вкл",
        soundOff: "Звук выкл",
        live: "LIVE",
        demo: "DEMO"
      },
      nav: { aria: "Навигация" },
      lobby: {
        eyebrow: "Лобби",
        title: "Садитесь за стол и запускайте быструю раздачу",
        description: "Blackjack 3:2, дилер берёт на мягких 17, история игр и магазин фишек уже внутри Mini App.",
        startRound: "Начать раздачу",
        currentTable: "К текущему столу",
        history: "История игр",
        balance: "Баланс",
        rounds: "Раундов",
        wins: "Побед",
        pushes: "Пушей",
        lastGame: "Последняя игра",
        totalWagered: "Сумма ставок"
      },
      table: {
        bet: "Ставка",
        player: "Игрок",
        rules: "Правила",
        deck: "Колода",
        dealerHitsSoft17: "Дилер берёт на мягких 17",
        cards: "карт",
        dealer: "Дилер",
        casino: "Казино",
        yourTable: "Стол",
        ready: "Готов к раздаче",
        roundClosed: "Раунд закрыт",
        yourTurn: "Ваш ход",
        controls: "Управление",
        selectBet: "Выберите ставку и начинайте новую раздачу",
        quickActions: "Hit, Stand или Double прямо в Mini App",
        inPlay: "В игре"
      },
      actions: {
        deal: "Раздать",
        redeal: "Ещё раз",
        hit: "Hit",
        stand: "Stand",
        double: "Double",
        split: "Split",
        surrender: "Surrender"
      },
      history: {
        eyebrow: "История",
        title: "Последние раздачи",
        refresh: "Обновить",
        emptyTitle: "Пока пусто",
        emptyDescription: "Сыграйте первую раздачу, чтобы здесь появилась история.",
        bet: "Ставка",
        payout: "Выплата"
      },
      shop: {
        eyebrow: "Магазин",
        title: "Пакеты фишек для Telegram Stars",
        note: "UI готов, бэкенд-оплату можно подключить к этим пакетам без переделки экрана.",
        select: "Выбрать",
        stars: "Stars",
        packs: {
          bronze: "Bronze Stack",
          silver: "Silver Stack",
          gold: "Gold Vault",
          vip: "Platinum Room"
        }
      },
      settings: {
        eyebrow: "Настройки",
        title: "Язык и параметры приложения",
        description: "Язык определяется автоматически из Telegram. Здесь его можно вручную переопределить.",
        language: "Язык",
        current: "Текущий язык",
        autoDetected: "Определён из Telegram",
        manual: "Ручной выбор сохранён на этом устройстве"
      },
      results: {
        player_win: "Выигрыш",
        player_blackjack: "Blackjack 3:2",
        dealer_win: "Поражение",
        dealer_blackjack: "У дилера Blackjack",
        push: "Push"
      },
      outcomes: { win: "Выигрыш", lose: "Поражение", blackjack: "Blackjack", bust: "Перебор", push: "Push" },
      common: {
        chips: "фишек",
        noGames: "Нет игр",
        seatFallback: "Место 1"
      },
      toasts: {
        socketError: "Ошибка сокета",
        shopUnavailable: "Покупки через Telegram Stars готовы к подключению на backend",
        packPrepared: "Пакет {{title}} подготовлен для интеграции со Stars"
      },
      mainButton: {
        newRound: "Новая раздача",
        stand: "Stand",
        takeSeat: "Сесть за стол",
        openShop: "Открыть магазин",
        toTable: "К столу"
      }
    }
  },
  ar: {
    translation: {
      screens: { lobby: "الردهة", table: "الطاولة", history: "السجل", shop: "الرقائق", settings: "الإعدادات" },
      loading: { connecting: "جارٍ الاتصال بالطاولة..." },
      topbar: {
        eyebrow: "تطبيق تيليجرام المصغر",
        subtitle: "طاولة خضراء وجولات سريعة وأفضلية كازينو بالقواعد الكلاسيكية.",
        guest: "ضيف",
        soundOn: "الصوت يعمل",
        soundOff: "الصوت متوقف",
        live: "مباشر",
        demo: "تجريبي"
      },
      nav: { aria: "التنقل" },
      lobby: {
        eyebrow: "الردهة",
        title: "اجلس إلى الطاولة وابدأ توزيعًا سريعًا",
        description: "بلاك جاك تدفع 3:2، والموزع يسحب على 17 الناعمة، والسجل والمتجر داخل التطبيق.",
        startRound: "ابدأ الجولة",
        currentTable: "إلى الطاولة الحالية",
        history: "سجل اللعب",
        balance: "الرصيد",
        rounds: "الجولات",
        wins: "الانتصارات",
        pushes: "التعادلات",
        lastGame: "آخر لعبة",
        totalWagered: "إجمالي الرهانات"
      },
      table: {
        bet: "الرهان",
        player: "اللاعب",
        rules: "القواعد",
        deck: "الرزمة",
        dealerHitsSoft17: "الموزع يسحب على 17 الناعمة",
        cards: "بطاقة",
        dealer: "الموزع",
        casino: "الكازينو",
        yourTable: "الطاولة",
        ready: "جاهز للتوزيع",
        roundClosed: "انتهت الجولة",
        yourTurn: "دورك",
        controls: "التحكم",
        selectBet: "اختر الرهان وابدأ جولة جديدة",
        quickActions: "Hit و Stand و Double داخل التطبيق مباشرة",
        inPlay: "قيد اللعب"
      },
      actions: {
        deal: "توزيع",
        redeal: "إعادة توزيع",
        hit: "سحب",
        stand: "توقف",
        double: "مضاعفة",
        split: "تقسيم",
        surrender: "استسلام"
      },
      history: {
        eyebrow: "السجل",
        title: "أحدث الجولات",
        refresh: "تحديث",
        emptyTitle: "لا شيء هنا بعد",
        emptyDescription: "العب أول جولة ليظهر السجل هنا.",
        bet: "الرهان",
        payout: "العائد"
      },
      shop: {
        eyebrow: "المتجر",
        title: "حزم الرقائق مقابل Telegram Stars",
        note: "الواجهة جاهزة ويمكن توصيل الدفع الخلفي بهذه الحزم دون إعادة تصميم الشاشة.",
        select: "اختيار",
        stars: "Stars",
        packs: {
          bronze: "رزمة برونزية",
          silver: "رزمة فضية",
          gold: "خزنة ذهبية",
          vip: "غرفة بلاتينية"
        }
      },
      settings: {
        eyebrow: "الإعدادات",
        title: "اللغة وتفضيلات التطبيق",
        description: "يتم اكتشاف لغة تيليجرام تلقائيًا، ويمكنك تغييرها يدويًا هنا.",
        language: "اللغة",
        current: "اللغة الحالية",
        autoDetected: "مكتشفة من تيليجرام",
        manual: "اختيار يدوي محفوظ على هذا الجهاز"
      },
      results: {
        player_win: "فوز",
        player_blackjack: "بلاك جاك 3:2",
        dealer_win: "خسارة",
        dealer_blackjack: "بلاك جاك للموزع",
        push: "تعادل"
      },
      outcomes: { win: "فوز", lose: "خسارة", blackjack: "بلاك جاك", bust: "تجاوز 21", push: "تعادل" },
      common: {
        chips: "رقاقة",
        noGames: "لا توجد ألعاب",
        seatFallback: "المقعد 1"
      },
      toasts: {
        socketError: "خطأ في الاتصال",
        shopUnavailable: "مشتريات Telegram Stars جاهزة للربط مع الخادم",
        packPrepared: "تم تجهيز {{title}} لدمج Telegram Stars"
      },
      mainButton: {
        newRound: "جولة جديدة",
        stand: "توقف",
        takeSeat: "اجلس",
        openShop: "افتح المتجر",
        toTable: "إلى الطاولة"
      }
    }
  },
  es: {
    translation: {
      screens: { lobby: "Lobby", table: "Mesa", history: "Historial", shop: "Fichas", settings: "Ajustes" },
      loading: { connecting: "Conectando a la mesa..." },
      topbar: {
        eyebrow: "Mini App de Telegram",
        subtitle: "Tapete verde, rondas rápidas y ventaja de la casa con reglas de casino.",
        guest: "Invitado",
        soundOn: "Sonido activado",
        soundOff: "Sonido desactivado",
        live: "LIVE",
        demo: "DEMO"
      },
      nav: { aria: "Navegación" },
      lobby: {
        eyebrow: "Lobby",
        title: "Siéntate en la mesa y lanza una mano rápida",
        description: "Blackjack paga 3:2, el crupier pide con 17 suave, y el historial y la tienda ya están en la Mini App.",
        startRound: "Empezar mano",
        currentTable: "Ir a la mesa actual",
        history: "Historial de juego",
        balance: "Saldo",
        rounds: "Rondas",
        wins: "Victorias",
        pushes: "Empates",
        lastGame: "Última partida",
        totalWagered: "Apostado total"
      },
      table: {
        bet: "Apuesta",
        player: "Jugador",
        rules: "Reglas",
        deck: "Mazo",
        dealerHitsSoft17: "El crupier pide con 17 suave",
        cards: "cartas",
        dealer: "Crupier",
        casino: "Casino",
        yourTable: "Mesa",
        ready: "Listo para repartir",
        roundClosed: "Ronda cerrada",
        yourTurn: "Tu turno",
        controls: "Controles",
        selectBet: "Elige una apuesta y empieza una ronda nueva",
        quickActions: "Hit, Stand o Double dentro de la Mini App",
        inPlay: "En juego"
      },
      actions: {
        deal: "Repartir",
        redeal: "Repartir otra vez",
        hit: "Pedir",
        stand: "Plantarse",
        double: "Doblar",
        split: "Dividir",
        surrender: "Rendirse"
      },
      history: {
        eyebrow: "Historial",
        title: "Últimas manos",
        refresh: "Actualizar",
        emptyTitle: "Todavía está vacío",
        emptyDescription: "Juega tu primera mano y el historial aparecerá aquí.",
        bet: "Apuesta",
        payout: "Pago"
      },
      shop: {
        eyebrow: "Tienda",
        title: "Paquetes de fichas para Telegram Stars",
        note: "La interfaz está lista. Los pagos del backend pueden conectarse a estos paquetes sin rehacer la pantalla.",
        select: "Elegir",
        stars: "Stars",
        packs: {
          bronze: "Paquete Bronce",
          silver: "Paquete Plata",
          gold: "Bóveda Oro",
          vip: "Sala Platino"
        }
      },
      settings: {
        eyebrow: "Ajustes",
        title: "Idioma y preferencias de la app",
        description: "La app detecta automáticamente el idioma de Telegram. Puedes cambiarlo aquí cuando quieras.",
        language: "Idioma",
        current: "Idioma actual",
        autoDetected: "Detectado desde Telegram",
        manual: "Selección manual guardada en este dispositivo"
      },
      results: {
        player_win: "Victoria",
        player_blackjack: "Blackjack 3:2",
        dealer_win: "Derrota",
        dealer_blackjack: "Blackjack del crupier",
        push: "Empate"
      },
      outcomes: { win: "Victoria", lose: "Derrota", blackjack: "Blackjack", bust: "Se pasó", push: "Empate" },
      common: {
        chips: "fichas",
        noGames: "Sin partidas",
        seatFallback: "Asiento 1"
      },
      toasts: {
        socketError: "Error de socket",
        shopUnavailable: "Las compras con Telegram Stars están listas para conectarse al backend",
        packPrepared: "{{title}} está listo para la integración con Telegram Stars"
      },
      mainButton: {
        newRound: "Nueva mano",
        stand: "Plantarse",
        takeSeat: "Sentarse",
        openShop: "Abrir tienda",
        toTable: "A la mesa"
      }
    }
  },
  pt: {
    translation: {
      screens: { lobby: "Lobby", table: "Mesa", history: "Histórico", shop: "Fichas", settings: "Configurações" },
      loading: { connecting: "Conectando à mesa..." },
      topbar: {
        eyebrow: "Mini App do Telegram",
        subtitle: "Mesa verde, rodadas rápidas e vantagem da casa nas regras de cassino.",
        guest: "Convidado",
        soundOn: "Som ligado",
        soundOff: "Som desligado",
        live: "AO VIVO",
        demo: "DEMO"
      },
      nav: { aria: "Navegação" },
      lobby: {
        eyebrow: "Lobby",
        title: "Sente-se à mesa e inicie uma rodada rápida",
        description: "Blackjack paga 3:2, o dealer compra no 17 suave, e o histórico e a loja já estão na Mini App.",
        startRound: "Começar rodada",
        currentTable: "Ir para a mesa atual",
        history: "Histórico de jogos",
        balance: "Saldo",
        rounds: "Rodadas",
        wins: "Vitórias",
        pushes: "Empates",
        lastGame: "Último jogo",
        totalWagered: "Total apostado"
      },
      table: {
        bet: "Aposta",
        player: "Jogador",
        rules: "Regras",
        deck: "Baralho",
        dealerHitsSoft17: "Dealer compra no 17 suave",
        cards: "cartas",
        dealer: "Dealer",
        casino: "Cassino",
        yourTable: "Mesa",
        ready: "Pronto para distribuir",
        roundClosed: "Rodada encerrada",
        yourTurn: "Sua vez",
        controls: "Controles",
        selectBet: "Escolha a aposta e inicie uma nova rodada",
        quickActions: "Hit, Stand ou Double dentro da Mini App",
        inPlay: "Em jogo"
      },
      actions: {
        deal: "Distribuir",
        redeal: "Redistribuir",
        hit: "Pedir",
        stand: "Parar",
        double: "Dobrar",
        split: "Separar",
        surrender: "Render-se"
      },
      history: {
        eyebrow: "Histórico",
        title: "Rodadas recentes",
        refresh: "Atualizar",
        emptyTitle: "Ainda está vazio",
        emptyDescription: "Jogue a primeira rodada para ver o histórico aqui.",
        bet: "Aposta",
        payout: "Pagamento"
      },
      shop: {
        eyebrow: "Loja",
        title: "Pacotes de fichas para Telegram Stars",
        note: "A interface está pronta. O pagamento do backend pode ser conectado a esses pacotes sem refazer a tela.",
        select: "Escolher",
        stars: "Stars",
        packs: {
          bronze: "Pacote Bronze",
          silver: "Pacote Prata",
          gold: "Cofre Ouro",
          vip: "Sala Platina"
        }
      },
      settings: {
        eyebrow: "Configurações",
        title: "Idioma e preferências do app",
        description: "O app detecta o idioma do Telegram automaticamente. Você pode substituí-lo aqui quando quiser.",
        language: "Idioma",
        current: "Idioma atual",
        autoDetected: "Detectado do Telegram",
        manual: "Seleção manual salva neste dispositivo"
      },
      results: {
        player_win: "Vitória",
        player_blackjack: "Blackjack 3:2",
        dealer_win: "Derrota",
        dealer_blackjack: "Blackjack do dealer",
        push: "Empate"
      },
      outcomes: { win: "Vitória", lose: "Derrota", blackjack: "Blackjack", bust: "Estourou", push: "Empate" },
      common: {
        chips: "fichas",
        noGames: "Sem jogos",
        seatFallback: "Assento 1"
      },
      toasts: {
        socketError: "Erro de socket",
        shopUnavailable: "As compras via Telegram Stars estão prontas para integração no backend",
        packPrepared: "{{title}} está pronto para integração com Telegram Stars"
      },
      mainButton: {
        newRound: "Nova rodada",
        stand: "Parar",
        takeSeat: "Sentar à mesa",
        openShop: "Abrir loja",
        toTable: "Para a mesa"
      }
    }
  },
  tr: {
    translation: {
      screens: { lobby: "Lobi", table: "Masa", history: "Geçmiş", shop: "Fişler", settings: "Ayarlar" },
      loading: { connecting: "Masaya bağlanılıyor..." },
      topbar: {
        eyebrow: "Telegram Mini Uygulaması",
        subtitle: "Yeşil çuha, hızlı eller ve casino kurallarıyla kasa avantajı.",
        guest: "Misafir",
        soundOn: "Ses Açık",
        soundOff: "Ses Kapalı",
        live: "CANLI",
        demo: "DEMO"
      },
      nav: { aria: "Gezinme" },
      lobby: {
        eyebrow: "Lobi",
        title: "Masaya otur ve hızlı bir dağıtım başlat",
        description: "Blackjack 3:2 öder, krupiye yumuşak 17'de kart çeker, geçmiş ve fiş mağazası Mini App içinde hazır.",
        startRound: "Eli başlat",
        currentTable: "Mevcut masaya git",
        history: "Oyun geçmişi",
        balance: "Bakiye",
        rounds: "El",
        wins: "Kazanç",
        pushes: "Berabere",
        lastGame: "Son oyun",
        totalWagered: "Toplam bahis"
      },
      table: {
        bet: "Bahis",
        player: "Oyuncu",
        rules: "Kurallar",
        deck: "Deste",
        dealerHitsSoft17: "Krupiye yumuşak 17'de çeker",
        cards: "kart",
        dealer: "Krupiye",
        casino: "Casino",
        yourTable: "Masa",
        ready: "Dağıtıma hazır",
        roundClosed: "El kapandı",
        yourTurn: "Sıra sende",
        controls: "Kontroller",
        selectBet: "Bahis seç ve yeni bir el başlat",
        quickActions: "Mini App içinde doğrudan Hit, Stand veya Double",
        inPlay: "Oyunda"
      },
      actions: {
        deal: "Dağıt",
        redeal: "Yeniden dağıt",
        hit: "Kart",
        stand: "Dur",
        double: "İkiye Katla",
        split: "Böl",
        surrender: "Teslim Ol"
      },
      history: {
        eyebrow: "Geçmiş",
        title: "Son eller",
        refresh: "Yenile",
        emptyTitle: "Henüz boş",
        emptyDescription: "İlk elini oyna, geçmiş burada görünsün.",
        bet: "Bahis",
        payout: "Ödeme"
      },
      shop: {
        eyebrow: "Mağaza",
        title: "Telegram Stars için fiş paketleri",
        note: "Arayüz hazır. Backend ödemeleri bu paketlere ekranı yeniden yapmadan bağlanabilir.",
        select: "Seç",
        stars: "Stars",
        packs: {
          bronze: "Bronz Paket",
          silver: "Gümüş Paket",
          gold: "Altın Kasa",
          vip: "Platin Oda"
        }
      },
      settings: {
        eyebrow: "Ayarlar",
        title: "Dil ve uygulama tercihleri",
        description: "Uygulama Telegram dilini otomatik algılar. İstediğinde buradan değiştirebilirsin.",
        language: "Dil",
        current: "Geçerli dil",
        autoDetected: "Telegram'dan otomatik algılandı",
        manual: "Manuel seçim bu cihazda kaydedildi"
      },
      results: {
        player_win: "Kazandın",
        player_blackjack: "Blackjack 3:2",
        dealer_win: "Kaybettin",
        dealer_blackjack: "Krupiye Blackjack",
        push: "Berabere"
      },
      outcomes: { win: "Kazanç", lose: "Kayıp", blackjack: "Blackjack", bust: "Patladı", push: "Berabere" },
      common: {
        chips: "fiş",
        noGames: "Oyun yok",
        seatFallback: "Koltuk 1"
      },
      toasts: {
        socketError: "Soket hatası",
        shopUnavailable: "Telegram Stars satın alımı backend entegrasyonu için hazır",
        packPrepared: "{{title}} Telegram Stars entegrasyonu için hazırlandı"
      },
      mainButton: {
        newRound: "Yeni el",
        stand: "Dur",
        takeSeat: "Masaya otur",
        openShop: "Mağazayı aç",
        toTable: "Masaya git"
      }
    }
  },
  fa: {
    translation: {
      screens: { lobby: "لابی", table: "میز", history: "تاریخچه", shop: "چیپ‌ها", settings: "تنظیمات" },
      loading: { connecting: "در حال اتصال به میز..." },
      topbar: {
        eyebrow: "مینی‌اپ تلگرام",
        subtitle: "میز سبز، دست‌های سریع و برتری کازینو با قوانین استاندارد.",
        guest: "مهمان",
        soundOn: "صدا روشن",
        soundOff: "صدا خاموش",
        live: "زنده",
        demo: "آزمایشی"
      },
      nav: { aria: "ناوبری" },
      lobby: {
        eyebrow: "لابی",
        title: "پشت میز بنشین و یک دست سریع شروع کن",
        description: "بلک‌جک ۳:۲ پرداخت می‌کند، دیلر روی ۱۷ نرم کارت می‌کشد و تاریخچه و فروشگاه داخل برنامه است.",
        startRound: "شروع دست",
        currentTable: "رفتن به میز فعلی",
        history: "تاریخچه بازی",
        balance: "موجودی",
        rounds: "دست‌ها",
        wins: "بردها",
        pushes: "پوش",
        lastGame: "آخرین بازی",
        totalWagered: "مجموع شرط"
      },
      table: {
        bet: "شرط",
        player: "بازیکن",
        rules: "قوانین",
        deck: "دسته",
        dealerHitsSoft17: "دیلر روی ۱۷ نرم کارت می‌کشد",
        cards: "کارت",
        dealer: "دیلر",
        casino: "کازینو",
        yourTable: "میز",
        ready: "آماده پخش",
        roundClosed: "دست بسته شد",
        yourTurn: "نوبت شما",
        controls: "کنترل‌ها",
        selectBet: "شرط را انتخاب کن و دست جدید را شروع کن",
        quickActions: "Hit، Stand یا Double مستقیماً داخل Mini App",
        inPlay: "در جریان بازی"
      },
      actions: {
        deal: "پخش",
        redeal: "پخش دوباره",
        hit: "کارت",
        stand: "ایست",
        double: "دابل",
        split: "اسپلیت",
        surrender: "تسلیم"
      },
      history: {
        eyebrow: "تاریخچه",
        title: "دست‌های اخیر",
        refresh: "به‌روزرسانی",
        emptyTitle: "هنوز خالی است",
        emptyDescription: "اولین دست را بازی کن تا تاریخچه اینجا دیده شود.",
        bet: "شرط",
        payout: "پرداخت"
      },
      shop: {
        eyebrow: "فروشگاه",
        title: "بسته‌های چیپ برای Telegram Stars",
        note: "رابط آماده است و پرداخت بک‌اند بدون بازطراحی صفحه به این بسته‌ها وصل می‌شود.",
        select: "انتخاب",
        stars: "Stars",
        packs: {
          bronze: "بسته برنزی",
          silver: "بسته نقره‌ای",
          gold: "خزانه طلایی",
          vip: "اتاق پلاتینیوم"
        }
      },
      settings: {
        eyebrow: "تنظیمات",
        title: "زبان و ترجیحات برنامه",
        description: "زبان تلگرام به‌صورت خودکار تشخیص داده می‌شود و هر زمان بخواهید می‌توانید آن را تغییر دهید.",
        language: "زبان",
        current: "زبان فعلی",
        autoDetected: "تشخیص داده‌شده از تلگرام",
        manual: "انتخاب دستی روی این دستگاه ذخیره شد"
      },
      results: {
        player_win: "برد",
        player_blackjack: "بلک‌جک ۳:۲",
        dealer_win: "باخت",
        dealer_blackjack: "بلک‌جک دیلر",
        push: "پوش"
      },
      outcomes: { win: "برد", lose: "باخت", blackjack: "بلک‌جک", bust: "سوخت", push: "پوش" },
      common: {
        chips: "چیپ",
        noGames: "بازی ندارد",
        seatFallback: "صندلی ۱"
      },
      toasts: {
        socketError: "خطای سوکت",
        shopUnavailable: "خرید با Telegram Stars برای اتصال بک‌اند آماده است",
        packPrepared: "{{title}} برای ادغام با Telegram Stars آماده شد"
      },
      mainButton: {
        newRound: "دست جدید",
        stand: "ایست",
        takeSeat: "نشستن",
        openShop: "باز کردن فروشگاه",
        toTable: "رفتن به میز"
      }
    }
  },
  hi: {
    translation: {
      screens: { lobby: "लॉबी", table: "टेबल", history: "इतिहास", shop: "चिप्स", settings: "सेटिंग्स" },
      loading: { connecting: "टेबल से जुड़ रहे हैं..." },
      topbar: {
        eyebrow: "Telegram Mini App",
        subtitle: "ग्रीन फेल्ट, तेज़ राउंड और कैसीनो-स्टाइल हाउस एज।",
        guest: "अतिथि",
        soundOn: "साउंड ऑन",
        soundOff: "साउंड ऑफ",
        live: "LIVE",
        demo: "DEMO"
      },
      nav: { aria: "नेविगेशन" },
      lobby: {
        eyebrow: "लॉबी",
        title: "टेबल पर बैठें और तेज़ डील शुरू करें",
        description: "ब्लैकजैक 3:2 देता है, डीलर सॉफ्ट 17 पर हिट करता है, और हिस्ट्री व शॉप Mini App में ही हैं।",
        startRound: "राउंड शुरू करें",
        currentTable: "मौजूदा टेबल पर जाएँ",
        history: "गेम इतिहास",
        balance: "बैलेंस",
        rounds: "राउंड",
        wins: "जीत",
        pushes: "पुश",
        lastGame: "आखिरी गेम",
        totalWagered: "कुल दांव"
      },
      table: {
        bet: "दांव",
        player: "खिलाड़ी",
        rules: "नियम",
        deck: "डेक",
        dealerHitsSoft17: "डीलर सॉफ्ट 17 पर हिट करता है",
        cards: "कार्ड",
        dealer: "डीलर",
        casino: "कैसीनो",
        yourTable: "टेबल",
        ready: "डील के लिए तैयार",
        roundClosed: "राउंड बंद",
        yourTurn: "आपकी बारी",
        controls: "कंट्रोल्स",
        selectBet: "दांव चुनें और नया राउंड शुरू करें",
        quickActions: "Mini App में सीधे Hit, Stand या Double",
        inPlay: "खेल में"
      },
      actions: {
        deal: "डील",
        redeal: "फिर से डील",
        hit: "हिट",
        stand: "स्टैंड",
        double: "डबल",
        split: "स्प्लिट",
        surrender: "सरेंडर"
      },
      history: {
        eyebrow: "इतिहास",
        title: "हाल की डील्स",
        refresh: "रिफ्रेश",
        emptyTitle: "अभी खाली है",
        emptyDescription: "अपनी पहली डील खेलें, फिर इतिहास यहाँ दिखेगा।",
        bet: "दांव",
        payout: "भुगतान"
      },
      shop: {
        eyebrow: "शॉप",
        title: "Telegram Stars के लिए चिप पैक",
        note: "UI तैयार है। बैकएंड पेमेंट्स को बिना स्क्रीन बदले इन पैक्स से जोड़ा जा सकता है।",
        select: "चुनें",
        stars: "Stars",
        packs: {
          bronze: "ब्रॉन्ज स्टैक",
          silver: "सिल्वर स्टैक",
          gold: "गोल्ड वॉल्ट",
          vip: "प्लैटिनम रूम"
        }
      },
      settings: {
        eyebrow: "सेटिंग्स",
        title: "भाषा और ऐप प्राथमिकताएँ",
        description: "ऐप Telegram भाषा अपने आप पहचानता है। आप इसे यहाँ कभी भी बदल सकते हैं।",
        language: "भाषा",
        current: "वर्तमान भाषा",
        autoDetected: "Telegram से स्वतः पहचानी गई",
        manual: "मैनुअल चयन इस डिवाइस पर सेव है"
      },
      results: {
        player_win: "जीत",
        player_blackjack: "Blackjack 3:2",
        dealer_win: "हार",
        dealer_blackjack: "डीलर ब्लैकजैक",
        push: "पुश"
      },
      outcomes: { win: "जीत", lose: "हार", blackjack: "ब्लैकजैक", bust: "बस्ट", push: "पुश" },
      common: {
        chips: "चिप्स",
        noGames: "कोई गेम नहीं",
        seatFallback: "सीट 1"
      },
      toasts: {
        socketError: "सॉकेट त्रुटि",
        shopUnavailable: "Telegram Stars खरीदारी बैकएंड इंटीग्रेशन के लिए तैयार है",
        packPrepared: "{{title}} Telegram Stars इंटीग्रेशन के लिए तैयार है"
      },
      mainButton: {
        newRound: "नया राउंड",
        stand: "स्टैंड",
        takeSeat: "सीट लें",
        openShop: "शॉप खोलें",
        toTable: "टेबल पर जाएँ"
      }
    }
  },
  zh: {
    translation: {
      screens: { lobby: "大厅", table: "牌桌", history: "历史", shop: "筹码", settings: "设置" },
      loading: { connecting: "正在连接牌桌..." },
      topbar: {
        eyebrow: "Telegram 小程序",
        subtitle: "绿色桌布、快速回合，以及标准赌场规则下的庄家优势。",
        guest: "访客",
        soundOn: "声音开启",
        soundOff: "声音关闭",
        live: "在线",
        demo: "演示"
      },
      nav: { aria: "导航" },
      lobby: {
        eyebrow: "大厅",
        title: "入座并快速开始一局",
        description: "Blackjack 3:2 赔付，庄家软 17 要牌，历史与筹码商店都已集成在 Mini App 中。",
        startRound: "开始发牌",
        currentTable: "前往当前牌桌",
        history: "游戏历史",
        balance: "余额",
        rounds: "局数",
        wins: "胜利",
        pushes: "平局",
        lastGame: "最近一局",
        totalWagered: "总下注"
      },
      table: {
        bet: "下注",
        player: "玩家",
        rules: "规则",
        deck: "牌堆",
        dealerHitsSoft17: "庄家软 17 要牌",
        cards: "张",
        dealer: "庄家",
        casino: "赌场",
        yourTable: "牌桌",
        ready: "准备发牌",
        roundClosed: "本局结束",
        yourTurn: "轮到你了",
        controls: "操作",
        selectBet: "选择下注并开始新一局",
        quickActions: "直接在 Mini App 中 Hit、Stand 或 Double",
        inPlay: "游戏中"
      },
      actions: {
        deal: "发牌",
        redeal: "重新发牌",
        hit: "要牌",
        stand: "停牌",
        double: "加倍",
        split: "分牌",
        surrender: "投降"
      },
      history: {
        eyebrow: "历史",
        title: "最近牌局",
        refresh: "刷新",
        emptyTitle: "这里还没有内容",
        emptyDescription: "先玩一局，历史记录就会显示在这里。",
        bet: "下注",
        payout: "赔付"
      },
      shop: {
        eyebrow: "商店",
        title: "Telegram Stars 筹码包",
        note: "界面已准备好，后端支付可以直接接入这些套餐，无需重做页面。",
        select: "选择",
        stars: "Stars",
        packs: {
          bronze: "青铜包",
          silver: "白银包",
          gold: "黄金库",
          vip: "白金房"
        }
      },
      settings: {
        eyebrow: "设置",
        title: "语言与应用偏好",
        description: "应用会自动识别 Telegram 语言，你也可以随时在这里手动切换。",
        language: "语言",
        current: "当前语言",
        autoDetected: "已从 Telegram 自动识别",
        manual: "手动选择已保存在此设备"
      },
      results: {
        player_win: "获胜",
        player_blackjack: "Blackjack 3:2",
        dealer_win: "失败",
        dealer_blackjack: "庄家 Blackjack",
        push: "平局"
      },
      outcomes: { win: "获胜", lose: "失败", blackjack: "Blackjack", bust: "爆牌", push: "平局" },
      common: {
        chips: "筹码",
        noGames: "暂无游戏",
        seatFallback: "座位 1"
      },
      toasts: {
        socketError: "Socket 错误",
        shopUnavailable: "Telegram Stars 购买已准备好接入后端",
        packPrepared: "{{title}} 已准备好接入 Telegram Stars"
      },
      mainButton: {
        newRound: "新一局",
        stand: "停牌",
        takeSeat: "入座",
        openShop: "打开商店",
        toTable: "前往牌桌"
      }
    }
  },
  id: {
    translation: {
      screens: { lobby: "Lobi", table: "Meja", history: "Riwayat", shop: "Chip", settings: "Pengaturan" },
      loading: { connecting: "Menghubungkan ke meja..." },
      topbar: {
        eyebrow: "Telegram Mini App",
        subtitle: "Felt hijau, ronde cepat, dan house edge ala kasino.",
        guest: "Tamu",
        soundOn: "Suara On",
        soundOff: "Suara Off",
        live: "LIVE",
        demo: "DEMO"
      },
      nav: { aria: "Navigasi" },
      lobby: {
        eyebrow: "Lobi",
        title: "Duduk di meja dan mulai deal cepat",
        description: "Blackjack membayar 3:2, dealer hit di soft 17, dan riwayat serta toko chip sudah ada di Mini App.",
        startRound: "Mulai ronde",
        currentTable: "Ke meja saat ini",
        history: "Riwayat game",
        balance: "Saldo",
        rounds: "Ronde",
        wins: "Menang",
        pushes: "Push",
        lastGame: "Game terakhir",
        totalWagered: "Total taruhan"
      },
      table: {
        bet: "Taruhan",
        player: "Pemain",
        rules: "Aturan",
        deck: "Deck",
        dealerHitsSoft17: "Dealer hit di soft 17",
        cards: "kartu",
        dealer: "Dealer",
        casino: "Kasino",
        yourTable: "Meja",
        ready: "Siap dibagikan",
        roundClosed: "Ronde selesai",
        yourTurn: "Giliranmu",
        controls: "Kontrol",
        selectBet: "Pilih taruhan dan mulai ronde baru",
        quickActions: "Hit, Stand, atau Double langsung di Mini App",
        inPlay: "Sedang dimainkan"
      },
      actions: {
        deal: "Deal",
        redeal: "Deal lagi",
        hit: "Hit",
        stand: "Stand",
        double: "Double",
        split: "Split",
        surrender: "Surrender"
      },
      history: {
        eyebrow: "Riwayat",
        title: "Deal terbaru",
        refresh: "Muat ulang",
        emptyTitle: "Masih kosong",
        emptyDescription: "Mainkan deal pertamamu agar riwayat muncul di sini.",
        bet: "Taruhan",
        payout: "Pembayaran"
      },
      shop: {
        eyebrow: "Toko",
        title: "Paket chip untuk Telegram Stars",
        note: "UI sudah siap. Pembayaran backend bisa dihubungkan ke paket ini tanpa mengubah layar.",
        select: "Pilih",
        stars: "Stars",
        packs: {
          bronze: "Paket Bronze",
          silver: "Paket Silver",
          gold: "Vault Gold",
          vip: "Ruang Platinum"
        }
      },
      settings: {
        eyebrow: "Pengaturan",
        title: "Bahasa dan preferensi aplikasi",
        description: "Aplikasi mendeteksi bahasa Telegram secara otomatis. Kamu bisa mengubahnya di sini kapan saja.",
        language: "Bahasa",
        current: "Bahasa saat ini",
        autoDetected: "Terdeteksi dari Telegram",
        manual: "Pilihan manual disimpan di perangkat ini"
      },
      results: {
        player_win: "Menang",
        player_blackjack: "Blackjack 3:2",
        dealer_win: "Kalah",
        dealer_blackjack: "Dealer Blackjack",
        push: "Push"
      },
      outcomes: { win: "Menang", lose: "Kalah", blackjack: "Blackjack", bust: "Bust", push: "Push" },
      common: {
        chips: "chip",
        noGames: "Belum ada game",
        seatFallback: "Kursi 1"
      },
      toasts: {
        socketError: "Error socket",
        shopUnavailable: "Pembelian Telegram Stars siap dihubungkan ke backend",
        packPrepared: "{{title}} siap untuk integrasi Telegram Stars"
      },
      mainButton: {
        newRound: "Ronde baru",
        stand: "Stand",
        takeSeat: "Duduk",
        openShop: "Buka toko",
        toTable: "Ke meja"
      }
    }
  },
  fr: {
    translation: {
      screens: { lobby: "Lobby", table: "Table", history: "Historique", shop: "Jetons", settings: "Réglages" },
      loading: { connecting: "Connexion à la table..." },
      topbar: {
        eyebrow: "Mini App Telegram",
        subtitle: "Tapis vert, manches rapides et avantage maison selon les règles du casino.",
        guest: "Invité",
        soundOn: "Son activé",
        soundOff: "Son coupé",
        live: "LIVE",
        demo: "DÉMO"
      },
      nav: { aria: "Navigation" },
      lobby: {
        eyebrow: "Lobby",
        title: "Prenez place et lancez une donne rapide",
        description: "Blackjack paie 3:2, le croupier tire sur 17 soft, et l'historique ainsi que la boutique sont déjà dans la Mini App.",
        startRound: "Démarrer la donne",
        currentTable: "Aller à la table",
        history: "Historique des parties",
        balance: "Solde",
        rounds: "Manches",
        wins: "Victoires",
        pushes: "Push",
        lastGame: "Dernière partie",
        totalWagered: "Mise totale"
      },
      table: {
        bet: "Mise",
        player: "Joueur",
        rules: "Règles",
        deck: "Sabot",
        dealerHitsSoft17: "Le croupier tire sur 17 soft",
        cards: "cartes",
        dealer: "Croupier",
        casino: "Casino",
        yourTable: "Table",
        ready: "Prêt à distribuer",
        roundClosed: "Manche terminée",
        yourTurn: "À vous de jouer",
        controls: "Commandes",
        selectBet: "Choisissez une mise et démarrez une nouvelle manche",
        quickActions: "Hit, Stand ou Double directement dans la Mini App",
        inPlay: "En cours"
      },
      actions: {
        deal: "Distribuer",
        redeal: "Redistribuer",
        hit: "Tirer",
        stand: "Rester",
        double: "Doubler",
        split: "Partager",
        surrender: "Abandonner"
      },
      history: {
        eyebrow: "Historique",
        title: "Dernières donnes",
        refresh: "Actualiser",
        emptyTitle: "Rien pour l'instant",
        emptyDescription: "Jouez votre première donne pour voir l'historique ici.",
        bet: "Mise",
        payout: "Gain"
      },
      shop: {
        eyebrow: "Boutique",
        title: "Packs de jetons pour Telegram Stars",
        note: "L'interface est prête. Les paiements backend peuvent être reliés à ces packs sans refaire l'écran.",
        select: "Choisir",
        stars: "Stars",
        packs: {
          bronze: "Pack Bronze",
          silver: "Pack Argent",
          gold: "Coffre Or",
          vip: "Salon Platine"
        }
      },
      settings: {
        eyebrow: "Réglages",
        title: "Langue et préférences de l'app",
        description: "L'app détecte automatiquement la langue de Telegram. Vous pouvez la remplacer ici à tout moment.",
        language: "Langue",
        current: "Langue actuelle",
        autoDetected: "Détectée depuis Telegram",
        manual: "Choix manuel enregistré sur cet appareil"
      },
      results: {
        player_win: "Victoire",
        player_blackjack: "Blackjack 3:2",
        dealer_win: "Défaite",
        dealer_blackjack: "Blackjack du croupier",
        push: "Égalité"
      },
      outcomes: { win: "Victoire", lose: "Défaite", blackjack: "Blackjack", bust: "Bust", push: "Égalité" },
      common: {
        chips: "jetons",
        noGames: "Aucune partie",
        seatFallback: "Siège 1"
      },
      toasts: {
        socketError: "Erreur de socket",
        shopUnavailable: "Les achats Telegram Stars sont prêts pour l'intégration backend",
        packPrepared: "{{title}} est prêt pour l'intégration Telegram Stars"
      },
      mainButton: {
        newRound: "Nouvelle donne",
        stand: "Rester",
        takeSeat: "S'asseoir",
        openShop: "Ouvrir la boutique",
        toTable: "Vers la table"
      }
    }
  },
  de: {
    translation: {
      screens: { lobby: "Lobby", table: "Tisch", history: "Verlauf", shop: "Chips", settings: "Einstellungen" },
      loading: { connecting: "Verbinde mit dem Tisch..." },
      topbar: {
        eyebrow: "Telegram Mini App",
        subtitle: "Grünes Filz, schnelle Runden und Hausvorteil nach Casino-Regeln.",
        guest: "Gast",
        soundOn: "Sound an",
        soundOff: "Sound aus",
        live: "LIVE",
        demo: "DEMO"
      },
      nav: { aria: "Navigation" },
      lobby: {
        eyebrow: "Lobby",
        title: "Nimm Platz und starte eine schnelle Runde",
        description: "Blackjack zahlt 3:2, der Dealer zieht auf Soft 17, und Verlauf sowie Chip-Shop sind schon in der Mini App.",
        startRound: "Runde starten",
        currentTable: "Zum aktuellen Tisch",
        history: "Spielverlauf",
        balance: "Kontostand",
        rounds: "Runden",
        wins: "Siege",
        pushes: "Push",
        lastGame: "Letztes Spiel",
        totalWagered: "Gesamte Einsätze"
      },
      table: {
        bet: "Einsatz",
        player: "Spieler",
        rules: "Regeln",
        deck: "Schuh",
        dealerHitsSoft17: "Dealer zieht auf Soft 17",
        cards: "Karten",
        dealer: "Dealer",
        casino: "Casino",
        yourTable: "Tisch",
        ready: "Bereit zum Geben",
        roundClosed: "Runde beendet",
        yourTurn: "Du bist dran",
        controls: "Aktionen",
        selectBet: "Wähle einen Einsatz und starte eine neue Runde",
        quickActions: "Hit, Stand oder Double direkt in der Mini App",
        inPlay: "Im Spiel"
      },
      actions: {
        deal: "Geben",
        redeal: "Neu geben",
        hit: "Hit",
        stand: "Stand",
        double: "Double",
        split: "Split",
        surrender: "Aufgeben"
      },
      history: {
        eyebrow: "Verlauf",
        title: "Letzte Runden",
        refresh: "Aktualisieren",
        emptyTitle: "Noch leer",
        emptyDescription: "Spiele deine erste Runde, dann erscheint der Verlauf hier.",
        bet: "Einsatz",
        payout: "Auszahlung"
      },
      shop: {
        eyebrow: "Shop",
        title: "Chip-Pakete für Telegram Stars",
        note: "Die UI ist fertig. Backend-Zahlungen können ohne Umbau an diese Pakete angebunden werden.",
        select: "Wählen",
        stars: "Stars",
        packs: {
          bronze: "Bronze-Paket",
          silver: "Silber-Paket",
          gold: "Gold-Tresor",
          vip: "Platin-Raum"
        }
      },
      settings: {
        eyebrow: "Einstellungen",
        title: "Sprache und App-Einstellungen",
        description: "Die App erkennt die Telegram-Sprache automatisch. Du kannst sie hier jederzeit überschreiben.",
        language: "Sprache",
        current: "Aktuelle Sprache",
        autoDetected: "Automatisch aus Telegram erkannt",
        manual: "Manuelle Auswahl auf diesem Gerät gespeichert"
      },
      results: {
        player_win: "Gewinn",
        player_blackjack: "Blackjack 3:2",
        dealer_win: "Verlust",
        dealer_blackjack: "Dealer Blackjack",
        push: "Push"
      },
      outcomes: { win: "Gewinn", lose: "Verlust", blackjack: "Blackjack", bust: "Bust", push: "Push" },
      common: {
        chips: "Chips",
        noGames: "Keine Spiele",
        seatFallback: "Platz 1"
      },
      toasts: {
        socketError: "Socket-Fehler",
        shopUnavailable: "Telegram-Stars-Käufe sind für die Backend-Integration bereit",
        packPrepared: "{{title}} ist für die Telegram-Stars-Integration vorbereitet"
      },
      mainButton: {
        newRound: "Neue Runde",
        stand: "Stand",
        takeSeat: "Hinsetzen",
        openShop: "Shop öffnen",
        toTable: "Zum Tisch"
      }
    }
  },
  it: {
    translation: {
      screens: { lobby: "Lobby", table: "Tavolo", history: "Cronologia", shop: "Fiches", settings: "Impostazioni" },
      loading: { connecting: "Connessione al tavolo..." },
      topbar: {
        eyebrow: "Mini App Telegram",
        subtitle: "Tappeto verde, round veloci e vantaggio del banco con regole da casinò.",
        guest: "Ospite",
        soundOn: "Audio attivo",
        soundOff: "Audio spento",
        live: "LIVE",
        demo: "DEMO"
      },
      nav: { aria: "Navigazione" },
      lobby: {
        eyebrow: "Lobby",
        title: "Siediti al tavolo e avvia una mano veloce",
        description: "Il Blackjack paga 3:2, il dealer tira su soft 17, e cronologia e shop sono già nella Mini App.",
        startRound: "Avvia mano",
        currentTable: "Vai al tavolo attuale",
        history: "Cronologia partite",
        balance: "Saldo",
        rounds: "Round",
        wins: "Vittorie",
        pushes: "Push",
        lastGame: "Ultima partita",
        totalWagered: "Totale puntato"
      },
      table: {
        bet: "Puntata",
        player: "Giocatore",
        rules: "Regole",
        deck: "Shoe",
        dealerHitsSoft17: "Il dealer tira su soft 17",
        cards: "carte",
        dealer: "Dealer",
        casino: "Casinò",
        yourTable: "Tavolo",
        ready: "Pronto a distribuire",
        roundClosed: "Round chiuso",
        yourTurn: "Tocca a te",
        controls: "Controlli",
        selectBet: "Scegli una puntata e avvia un nuovo round",
        quickActions: "Hit, Stand o Double direttamente nella Mini App",
        inPlay: "In corso"
      },
      actions: {
        deal: "Distribuisci",
        redeal: "Ridistribuisci",
        hit: "Hit",
        stand: "Stand",
        double: "Double",
        split: "Split",
        surrender: "Resa"
      },
      history: {
        eyebrow: "Cronologia",
        title: "Mani recenti",
        refresh: "Aggiorna",
        emptyTitle: "Ancora vuoto",
        emptyDescription: "Gioca la tua prima mano e la cronologia apparirà qui.",
        bet: "Puntata",
        payout: "Pagamento"
      },
      shop: {
        eyebrow: "Shop",
        title: "Pacchetti di fiches per Telegram Stars",
        note: "L'interfaccia è pronta. I pagamenti backend possono essere collegati a questi pacchetti senza rifare la schermata.",
        select: "Scegli",
        stars: "Stars",
        packs: {
          bronze: "Pacchetto Bronzo",
          silver: "Pacchetto Argento",
          gold: "Caveau Oro",
          vip: "Sala Platino"
        }
      },
      settings: {
        eyebrow: "Impostazioni",
        title: "Lingua e preferenze dell'app",
        description: "L'app rileva automaticamente la lingua di Telegram. Puoi cambiarla qui in qualsiasi momento.",
        language: "Lingua",
        current: "Lingua attuale",
        autoDetected: "Rilevata da Telegram",
        manual: "Selezione manuale salvata su questo dispositivo"
      },
      results: {
        player_win: "Vittoria",
        player_blackjack: "Blackjack 3:2",
        dealer_win: "Sconfitta",
        dealer_blackjack: "Blackjack del dealer",
        push: "Push"
      },
      outcomes: { win: "Vittoria", lose: "Sconfitta", blackjack: "Blackjack", bust: "Bust", push: "Push" },
      common: {
        chips: "fiches",
        noGames: "Nessuna partita",
        seatFallback: "Posto 1"
      },
      toasts: {
        socketError: "Errore socket",
        shopUnavailable: "Gli acquisti Telegram Stars sono pronti per l'integrazione backend",
        packPrepared: "{{title}} è pronto per l'integrazione con Telegram Stars"
      },
      mainButton: {
        newRound: "Nuovo round",
        stand: "Stand",
        takeSeat: "Siediti",
        openShop: "Apri shop",
        toTable: "Al tavolo"
      }
    }
  },
  ko: {
    translation: {
      screens: { lobby: "로비", table: "테이블", history: "기록", shop: "칩", settings: "설정" },
      loading: { connecting: "테이블에 연결 중..." },
      topbar: {
        eyebrow: "Telegram 미니 앱",
        subtitle: "초록 펠트, 빠른 라운드, 카지노 규칙 기반 하우스 엣지.",
        guest: "게스트",
        soundOn: "사운드 켜짐",
        soundOff: "사운드 꺼짐",
        live: "LIVE",
        demo: "DEMO"
      },
      nav: { aria: "탐색" },
      lobby: {
        eyebrow: "로비",
        title: "자리에 앉고 빠르게 딜을 시작하세요",
        description: "블랙잭은 3:2 배당, 딜러는 소프트 17에서 히트하며, 기록과 칩 상점이 Mini App 안에 있습니다.",
        startRound: "라운드 시작",
        currentTable: "현재 테이블로",
        history: "게임 기록",
        balance: "잔액",
        rounds: "라운드",
        wins: "승리",
        pushes: "푸시",
        lastGame: "최근 게임",
        totalWagered: "총 베팅"
      },
      table: {
        bet: "베팅",
        player: "플레이어",
        rules: "규칙",
        deck: "덱",
        dealerHitsSoft17: "딜러는 소프트 17에서 히트",
        cards: "장",
        dealer: "딜러",
        casino: "카지노",
        yourTable: "테이블",
        ready: "딜 준비 완료",
        roundClosed: "라운드 종료",
        yourTurn: "당신의 차례",
        controls: "조작",
        selectBet: "베팅을 선택하고 새 라운드를 시작하세요",
        quickActions: "Mini App 안에서 바로 Hit, Stand, Double",
        inPlay: "진행 중"
      },
      actions: {
        deal: "딜",
        redeal: "다시 딜",
        hit: "히트",
        stand: "스탠드",
        double: "더블",
        split: "스플릿",
        surrender: "서렌더"
      },
      history: {
        eyebrow: "기록",
        title: "최근 딜",
        refresh: "새로고침",
        emptyTitle: "아직 비어 있습니다",
        emptyDescription: "첫 딜을 플레이하면 여기 기록이 표시됩니다.",
        bet: "베팅",
        payout: "지급"
      },
      shop: {
        eyebrow: "상점",
        title: "Telegram Stars용 칩 패키지",
        note: "UI는 준비되었습니다. 백엔드 결제를 화면 수정 없이 이 패키지에 연결할 수 있습니다.",
        select: "선택",
        stars: "Stars",
        packs: {
          bronze: "브론즈 스택",
          silver: "실버 스택",
          gold: "골드 볼트",
          vip: "플래티넘 룸"
        }
      },
      settings: {
        eyebrow: "설정",
        title: "언어 및 앱 환경설정",
        description: "앱이 Telegram 언어를 자동으로 감지합니다. 언제든 여기서 변경할 수 있습니다.",
        language: "언어",
        current: "현재 언어",
        autoDetected: "Telegram에서 자동 감지됨",
        manual: "수동 선택이 이 기기에 저장됨"
      },
      results: {
        player_win: "승리",
        player_blackjack: "Blackjack 3:2",
        dealer_win: "패배",
        dealer_blackjack: "딜러 블랙잭",
        push: "푸시"
      },
      outcomes: { win: "승리", lose: "패배", blackjack: "블랙잭", bust: "버스트", push: "푸시" },
      common: {
        chips: "칩",
        noGames: "게임 없음",
        seatFallback: "좌석 1"
      },
      toasts: {
        socketError: "소켓 오류",
        shopUnavailable: "Telegram Stars 구매를 백엔드에 연결할 준비가 되었습니다",
        packPrepared: "{{title}} 패키지가 Telegram Stars 연동 준비됨"
      },
      mainButton: {
        newRound: "새 라운드",
        stand: "스탠드",
        takeSeat: "착석",
        openShop: "상점 열기",
        toTable: "테이블로"
      }
    }
  },
  ja: {
    translation: {
      screens: { lobby: "ロビー", table: "テーブル", history: "履歴", shop: "チップ", settings: "設定" },
      loading: { connecting: "テーブルに接続中..." },
      topbar: {
        eyebrow: "Telegram ミニアプリ",
        subtitle: "グリーンフェルト、高速ラウンド、カジノルールのハウスエッジ。",
        guest: "ゲスト",
        soundOn: "サウンドオン",
        soundOff: "サウンドオフ",
        live: "LIVE",
        demo: "DEMO"
      },
      nav: { aria: "ナビゲーション" },
      lobby: {
        eyebrow: "ロビー",
        title: "席に着いてすぐにディールを始める",
        description: "ブラックジャックは3:2配当、ディーラーはソフト17でヒット、履歴とチップショップもMini App内にあります。",
        startRound: "ラウンド開始",
        currentTable: "現在のテーブルへ",
        history: "ゲーム履歴",
        balance: "残高",
        rounds: "ラウンド",
        wins: "勝利",
        pushes: "プッシュ",
        lastGame: "直近のゲーム",
        totalWagered: "総ベット"
      },
      table: {
        bet: "ベット",
        player: "プレイヤー",
        rules: "ルール",
        deck: "シュー",
        dealerHitsSoft17: "ディーラーはソフト17でヒット",
        cards: "枚",
        dealer: "ディーラー",
        casino: "カジノ",
        yourTable: "テーブル",
        ready: "ディール準備完了",
        roundClosed: "ラウンド終了",
        yourTurn: "あなたの番",
        controls: "操作",
        selectBet: "ベットを選んで新しいラウンドを始める",
        quickActions: "Mini App内でそのまま Hit、Stand、Double",
        inPlay: "進行中"
      },
      actions: {
        deal: "ディール",
        redeal: "再ディール",
        hit: "ヒット",
        stand: "スタンド",
        double: "ダブル",
        split: "スプリット",
        surrender: "サレンダー"
      },
      history: {
        eyebrow: "履歴",
        title: "最近のディール",
        refresh: "更新",
        emptyTitle: "まだ空です",
        emptyDescription: "最初のディールをプレイすると、ここに履歴が表示されます。",
        bet: "ベット",
        payout: "払い戻し"
      },
      shop: {
        eyebrow: "ショップ",
        title: "Telegram Stars向けチップパック",
        note: "UIは準備済みです。バックエンド決済をこのパックにそのまま接続できます。",
        select: "選択",
        stars: "Stars",
        packs: {
          bronze: "ブロンズスタック",
          silver: "シルバースタック",
          gold: "ゴールドボールト",
          vip: "プラチナルーム"
        }
      },
      settings: {
        eyebrow: "設定",
        title: "言語とアプリ設定",
        description: "アプリはTelegramの言語を自動検出します。ここでいつでも手動変更できます。",
        language: "言語",
        current: "現在の言語",
        autoDetected: "Telegramから自動検出",
        manual: "手動選択はこの端末に保存されます"
      },
      results: {
        player_win: "勝利",
        player_blackjack: "Blackjack 3:2",
        dealer_win: "敗北",
        dealer_blackjack: "ディーラーのブラックジャック",
        push: "プッシュ"
      },
      outcomes: { win: "勝利", lose: "敗北", blackjack: "ブラックジャック", bust: "バスト", push: "プッシュ" },
      common: {
        chips: "チップ",
        noGames: "ゲームなし",
        seatFallback: "席 1"
      },
      toasts: {
        socketError: "ソケットエラー",
        shopUnavailable: "Telegram Stars 購入はバックエンド連携の準備ができています",
        packPrepared: "{{title}} は Telegram Stars 連携の準備ができています"
      },
      mainButton: {
        newRound: "新しいラウンド",
        stand: "スタンド",
        takeSeat: "着席",
        openShop: "ショップを開く",
        toTable: "テーブルへ"
      }
    }
  }
};

export function normalizeLanguageCode(code) {
  const value = String(code || "").trim().toLowerCase();
  if (!value) {
    return "en";
  }

  const exact = SUPPORTED_LANGUAGES.find((language) => language.code === value);
  if (exact) {
    return exact.code;
  }

  const primary = value.split(/[-_]/)[0];
  const prefix = SUPPORTED_LANGUAGES.find((language) => language.code === primary);
  if (prefix) {
    return prefix.code;
  }

  if (value.startsWith("zh")) {
    return "zh";
  }

  if (value.startsWith("pt")) {
    return "pt";
  }

  return "en";
}

export function detectPreferredLanguage(telegramLanguageCode) {
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved) {
    return normalizeLanguageCode(saved);
  }

  if (telegramLanguageCode) {
    return normalizeLanguageCode(telegramLanguageCode);
  }

  return normalizeLanguageCode(window.navigator.language);
}

export function persistLanguage(code) {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguageCode(code));
}

export function clearPersistedLanguage() {
  window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
}

export function isLanguagePersisted() {
  return Boolean(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

export function isRtlLanguage(code) {
  return ["ar", "fa"].includes(normalizeLanguageCode(code));
}

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
