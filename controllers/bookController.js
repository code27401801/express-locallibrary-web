const Book = require("../models/book");
const Author = require("../models/author");
const Genre = require("../models/genre");
const BookInstance = require("../models/bookinstance");

const { body, validationResult } = require("express-validator");
const asyncHandler = require("express-async-handler");

exports.index = asyncHandler(async (req, res, next) => {
  // 書籍、所蔵資料、著者、ジャンルの数を取得（並列処理）
  const [
    numBooks,
    numBookInstances,
    numAvailableBookInstances,
    numAuthors,
    numGenres,
  ] = await Promise.all([
    Book.countDocuments({}).exec(),
    BookInstance.countDocuments({}).exec(),
    BookInstance.countDocuments({ status: "Available" }).exec(),
    Author.countDocuments({}).exec(),
    Genre.countDocuments({}).exec(),
  ]);

  res.render("index", {
    title: "ライブラリホーム", // 翻訳箇所
    book_count: numBooks,
    book_instance_count: numBookInstances,
    book_instance_available_count: numAvailableBookInstances,
    author_count: numAuthors,
    genre_count: numGenres,
  });
});

// すべての書籍の一覧を表示
exports.book_list = asyncHandler(async (req, res, next) => {
  const allBooks = await Book.find({}, "title author")
    .sort({ title: 1 })
    .populate("author")
    .exec();

  res.render("book_list", { 
    title: "書籍一覧", // 翻訳箇所
    book_list: allBooks 
  });
});

// 特定の書籍の詳細ページを表示
exports.book_detail = asyncHandler(async (req, res, next) => {
  const [book, bookInstances] = await Promise.all([
    Book.findById(req.params.id).populate("author").populate("genre").exec(),
    BookInstance.find({ book: req.params.id }).exec(),
  ]);

  if (book === null) {
    const err = new Error("書籍が見つかりません"); // 翻訳箇所
    err.status = 404;
    return next(err);
  }

  res.render("book_detail", {
    title: book.title,
    book: book,
    book_instances: bookInstances,
  });
});

// 書籍作成フォームを表示 (GET)
exports.book_create_get = asyncHandler(async (req, res, next) => {
  const [allAuthors, allGenres] = await Promise.all([
    Author.find().sort({ family_name: 1 }).exec(),
    Genre.find().sort({ name: 1 }).exec(),
  ]);

  res.render("book_form", {
    title: "書籍登録", // 翻訳箇所
    authors: allAuthors,
    genres: allGenres,
  });
});

// 書籍作成を処理 (POST)
exports.book_create_post = [
  (req, res, next) => {
    if (!Array.isArray(req.body.genre)) {
      req.body.genre =
        typeof req.body.genre === "undefined" ? [] : [req.body.genre];
    }
    next();
  },

  // バリデーションとサニタイズ
  body("title", "タイトルは必須です") // 翻訳箇所
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("author", "著者を選択してください") // 翻訳箇所
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("summary", "概要を入力してください") // 翻訳箇所
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("isbn", "ISBNは必須です") // 翻訳箇所
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("genre.*").escape(),

  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    const book = new Book({
      title: req.body.title,
      author: req.body.author,
      summary: req.body.summary,
      isbn: req.body.isbn,
      genre: req.body.genre,
    });

    if (!errors.isEmpty()) {
      const [allAuthors, allGenres] = await Promise.all([
        Author.find().sort({ family_name: 1 }).exec(),
        Genre.find().sort({ name: 1 }).exec(),
      ]);

      for (const genre of allGenres) {
        if (book.genre.indexOf(genre._id) > -1) {
          genre.checked = "true";
        }
      }
      res.render("book_form", {
        title: "書籍登録", // 翻訳箇所
        authors: allAuthors,
        genres: allGenres,
        book: book,
        errors: errors.array(),
      });
    } else {
      await book.save();
      res.redirect(book.url);
    }
  }),
];

// 書籍削除フォームを表示 (GET)
exports.book_delete_get = asyncHandler(async (req, res, next) => {
  const [book, bookInstances] = await Promise.all([
    Book.findById(req.params.id).populate("author").populate("genre").exec(),
    BookInstance.find({ book: req.params.id }).exec(),
  ]);

  if (book === null) {
    res.redirect("/catalog/books");
  }

  res.render("book_delete", {
    title: "書籍削除", // 翻訳箇所
    book: book,
    book_instances: bookInstances,
  });
});

// 書籍削除を処理 (POST)
exports.book_delete_post = asyncHandler(async (req, res, next) => {
  const [book, bookInstances] = await Promise.all([
    Book.findById(req.params.id).populate("author").populate("genre").exec(),
    BookInstance.find({ book: req.params.id }).exec(),
  ]);

  if (book === null) {
    res.redirect("/catalog/books");
  }

  if (bookInstances.length > 0) {
    res.render("book_delete", {
      title: "書籍削除", // 翻訳箇所
      book: book,
      book_instances: bookInstances,
    });
    return;
  } else {
    await Book.findByIdAndDelete(req.body.id);
    res.redirect("/catalog/books");
  }
});

// 書籍更新フォームを表示 (GET)
exports.book_update_get = asyncHandler(async (req, res, next) => {
  const [book, allAuthors, allGenres] = await Promise.all([
    Book.findById(req.params.id).populate("author").exec(),
    Author.find().sort({ family_name: 1 }).exec(),
    Genre.find().sort({ name: 1 }).exec(),
  ]);

  if (book === null) {
    const err = new Error("書籍が見つかりません"); // 翻訳箇所
    err.status = 404;
    return next(err);
  }

  allGenres.forEach((genre) => {
    if (book.genre.includes(genre._id)) genre.checked = "true";
  });

  res.render("book_form", {
    title: "書籍編集", // 翻訳箇所
    authors: allAuthors,
    genres: allGenres,
    book: book,
  });
});

// 書籍更新を処理 (POST)
exports.book_update_post = [
  (req, res, next) => {
    if (!Array.isArray(req.body.genre)) {
      req.body.genre =
        typeof req.body.genre === "undefined" ? [] : [req.body.genre];
    }
    next();
  },

  body("title", "タイトルは必須です") // 翻訳箇所
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("author", "著者を選択してください") // 翻訳箇所
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("summary", "概要を入力してください") // 翻訳箇所
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("isbn", "ISBNは必須です") // 翻訳箇所
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("genre.*").escape(),

  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    const book = new Book({
      title: req.body.title,
      author: req.body.author,
      summary: req.body.summary,
      isbn: req.body.isbn,
      genre: typeof req.body.genre === "undefined" ? [] : req.body.genre,
      _id: req.params.id,
    });

    if (!errors.isEmpty()) {
      const [allAuthors, allGenres] = await Promise.all([
        Author.find().sort({ family_name: 1 }).exec(),
        Genre.find().sort({ name: 1 }).exec(),
      ]);

      for (const genre of allGenres) {
        if (book.genre.includes(genre._id)) {
          genre.checked = "true";
        }
      }
      res.render("book_form", {
        title: "書籍編集", // 翻訳箇所
        authors: allAuthors,
        genres: allGenres,
        book: book,
        errors: errors.array(),
      });
      return;
    } else {
      const thebook = await Book.findByIdAndUpdate(req.params.id, book, {});
      res.redirect(thebook.url);
    }
  }),
];