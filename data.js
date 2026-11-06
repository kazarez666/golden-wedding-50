/* Весь изменяемый контент проекта — здесь.
   Примерные вопросы помечены как демо. Настоящие видео/аудио добавляются в media/.
*/
window.SITE_DATA = {
  names: { first: 'Павел Семёнович', second: 'Ольга Леонидовна', family: 'Смурыгины' },
  sections: [
    { id: 'entrance', title: 'Торжественная встреча', subtitle: 'Начало вечера', icon: '✦' },
    { id: 'welcome', title: 'Приветствие', subtitle: '50 лет вместе', icon: '♡' },
    { id: 'wedding', title: 'Свадебный ролик', subtitle: 'Воспоминания', icon: '▶' },
    { id: 'interviews', title: 'Интервью', subtitle: '16 видеороликов', icon: '▣' },
    { id: 'movies', title: 'Фильмы по эмодзи', subtitle: 'Киноконкурс', icon: '✳' },
    { id: 'melodies', title: 'Угадай мелодию', subtitle: 'Музыкальный конкурс', icon: '♫' },
    { id: 'pairs', title: 'Парный конкурс', subtitle: 'Объявление', icon: '♧' },
    { id: 'salads', title: 'Салаты и закуски', subtitle: 'Кулинарная викторина', icon: '❀' },
    { id: 'word', title: 'Загаданное слово', subtitle: 'Правила уточняются', icon: '✧' },
    { id: 'silhouettes', title: 'Силуэты', subtitle: 'Игра на память', icon: '◐' },
    { id: 'credits', title: 'Финальные титры', subtitle: 'Спасибо за вечер', icon: '★' }
  ],
  files: { march: 'media/march.mp3', wedding: 'media/wedding.mp4' },
  interviews: Array.from({ length: 16 }, (_, i) => ({ title: `Интервью ${String(i + 1).padStart(2, '0')}`, src: `media/interviews/${String(i + 1).padStart(2, '0')}.mp4` })),
  // Фильмы согласованы с организатором праздника. Эмодзи — авторские загадки.
  movies: [
    { emoji: '👨‍🔬 ⏳ 👑 🚪', answer: 'Иван Васильевич меняет профессию' },
    { emoji: '❤️ 🕊️ 🏡 🌊', answer: 'Любовь и голуби' },
    { emoji: '⚔️ 🤺 🤺 🤺 🪶', answer: 'Д’Артаньян и три мушкетёра' },
    { emoji: '🤠 🎬 🏜️ 🎞️', answer: 'Человек с бульвара Капуцинов' },
    { emoji: '1️⃣ 2️⃣ 🪑 💎', answer: '12 стульев' },
    { emoji: '☂️ 🌬️ 👒 🎶', answer: 'Мэри Поппинс, до свидания' },
    { emoji: '🕵️ 🔍 🎻 🩺', answer: 'Шерлок Холмс и доктор Ватсон' },
    { emoji: '🧑 🐠 🌊 💙', answer: 'Человек-амфибия' },
    { emoji: '🛸 🏜️ 🪐 🔔', answer: 'Кин-дза-дза!' },
    { emoji: '❤️ ⚗️ 🗿 ✨', answer: 'Формула любви' }
  ],
  melodies: Array.from({ length: 20 }, (_, i) => ({ title: `Мелодия ${String(i + 1).padStart(2, '0')}`, answer: 'Название ещё не добавлено', src: `media/melodies/${String(i + 1).padStart(2, '0')}.mp3` })),
  // Вопросы пока демонстрационные. Фотографии поместите в media/salads/01.jpg и т. д.
  salads: [
    { title: 'Селёдка под шубой', photo: 'media/salads/01.jpg' },
    { title: 'Оливье', photo: 'media/salads/02.jpg' },
    { title: 'Мимоза', photo: 'media/salads/03.jpg' },
    { title: 'Винегрет', photo: 'media/salads/04.jpg' },
    { title: 'Крабовый салат', photo: 'media/salads/05.jpg' }
  ],
  // Пока известна только подтверждённая роль Дарьи Павловны.
  credits: [
    { role: 'В главных ролях', names: ['Павел Семёнович', 'Ольга Леонидовна'] },
    { role: 'Конкурс «Салаты и закуски»', names: ['Дарья Павловна'] },
    { role: 'Организация и подготовка', names: ['Имена добавим позже'] },
    { role: 'Ведущие праздника', names: ['Имена добавим позже'] }
  ]
};
