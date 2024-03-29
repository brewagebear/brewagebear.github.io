module.exports = {
  title: `개발한입`,
  description: `개발한입`,
  language: `ko`, // `ko`, `en` => currently support versions for Korean and English
  siteUrl: `https://brewagebear.github.io`,
  ogImage: `/thumbnail.png`, // Path to your in the 'static' folder
  comments: {
    utterances: {
      repo: `brewagebear/blog-comments`, // `zoomkoding/zoomkoding-gatsby-blog`,
    },
  },
  ga: 'G-JSYQ7FRW6F', // Google Analytics Tracking ID
  author: {
    name: `Bear`,
    bio: {
      role: `소프트웨어 엔지니어`,
      description: ['즐겁게 개발하는'],
      thumbnail: 'calcifer.gif', // Path to the image in the 'asset' folder
    },
    social: {
      github: `https://github.com/brewagebear`, // `https://github.com/zoomKoding`,
      linkedIn: ``, // `https://www.linkedin.com/in/jinhyeok-jeong-800871192`,
      email: `dev.liquid.bear@gmail.com`, // `zoomkoding@gmail.com`,
    },
  },

  // metadata for About Page
  about: {
    timestamps: [
      // =====       [Timestamp Sample and Structure]      =====
      // ===== 🚫 Don't erase this sample (여기 지우지 마세요!) =====
      {
        date: '',
        activity: '',
        links: {
          github: '',
          post: '',
          googlePlay: '',
          appStore: '',
          demo: '',
        },
      },
      // ========================================================
      // 개인 연혁 영역
      // ========================================================
    ],

    projects: [
      // =====        [Project Sample and Structure]        =====
      // ===== 🚫 Don't erase this sample (여기 지우지 마세요!)  =====
      {
        title: '',
        description: '',
        techStack: ['', ''],
        thumbnailUrl: '',
        links: {
          post: '',
          github: '',
          googlePlay: '',
          appStore: '',
          demo: '',
        },
      },
      // ========================================================
      //  프로젝트 영역
      // ========================================================
    ],
  },
};
