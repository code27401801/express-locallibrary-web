const Genre = require("../models/genre");
const Book = require("../models/book");

const { body, validationResult } = require("express-validator");
const asyncHandler = require("express-async-handler");

// 全てのジャンル一覧を表示
exports.genre_list = asyncHandler(async (req, res, next) => {
  const allGenres = await Genre.find().sort({ name: 1 }).exec();
  res.render("genre_list", {
    title: "ジャンル一覧",
    list_genres: allGenres,
  });
});

// 特定ジャンルの詳細ページを表示
exports.genre_detail = asyncHandler(async (req, res, next) => {
  // ジャンル詳細と関連書籍を並列で取得
  const [genre, booksInGenre] = await Promise.all([
    Genre.findById(req.params.id).exec(),
    Book.find({ genre: req.params.id }, "title summary").exec(),
  ]);
  
  if (genre === null) {
    // 結果なし
    const err = new Error("ジャンルが見つかりません");
    err.status = 404;
    return next(err);
  }

  res.render("genre_detail", {
    title: "ジャンル詳細",
    genre: genre,
    genre_books: booksInGenre,
  });
});

// ジャンル作成フォームをGETで表示
exports.genre_create_get = (req, res, next) => {
  res.render("genre_form", { title: "ジャンル作成" });
};

// ジャンル作成をPOSTで処理
exports.genre_create_post = [
  // ジャンル名のバリデーションとサニタイズ
  body("name", "ジャンル名は3文字以上必要です")
    .trim()
    .isLength({ min: 3 })
    .escape(),

  // バリデーション後のリクエスト処理
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);

    // サニタイズされたデータでジャンルオブジェクト作成
    const genre = new Genre({ name: req.body.name });

    if (!errors.isEmpty()) {
      // エラーあり - フォームを再表示
      res.render("genre_form", {
        title: "ジャンル作成",
        genre: genre,
        errors: errors.array(),
      });
      return;
    } else {
      // データが有効
      // 同じ名前のジャンルが存在するか確認（大文字小文字を無視）
      const genreExists = await Genre.findOne({ name: req.body.name })
        .collation({ locale: "en", strength: 2 })
        .exec();
      
      if (genreExists) {
        // 既存ジャンルあり - 詳細ページへリダイレクト
        res.redirect(genreExists.url);
      } else {
        await genre.save();
        // 新規ジャンル保存後、詳細ページへリダイレクト
        res.redirect(genre.url);
      }
    }
  }),
];

// ジャンル削除フォームをGETで表示
exports.genre_delete_get = asyncHandler(async (req, res, next) => {
  // ジャンルと関連書籍を並列で取得
  const [genre, booksInGenre] = await Promise.all([
    Genre.findById(req.params.id).exec(),
    Book.find({ genre: req.params.id }, "title summary").exec(),
  ]);
  
  if (genre === null) {
    // 結果なし
    res.redirect("/catalog/genres");
  }

  res.render("genre_delete", {
    title: "ジャンル削除",
    genre: genre,
    genre_books: booksInGenre,
  });
});

// ジャンル削除をPOSTで処理
exports.genre_delete_post = asyncHandler(async (req, res, next) => {
  // ジャンルと関連書籍を並列で取得
  const [genre, booksInGenre] = await Promise.all([
    Genre.findById(req.params.id).exec(),
    Book.find({ genre: req.params.id }, "title summary").exec(),
  ]);

  if (booksInGenre.length > 0) {
    // 関連書籍あり - GETルートと同じように表示
    res.render("genre_delete", {
      title: "ジャンル削除",
      genre: genre,
      genre_books: booksInGenre,
    });
    return;
  } else {
    // 関連書籍なし - 削除してジャンル一覧へリダイレクト
    await Genre.findByIdAndDelete(req.body.id);
    res.redirect("/catalog/genres");
  }
});

// ジャンル更新フォームをGETで表示
exports.genre_update_get = asyncHandler(async (req, res, next) => {
  const genre = await Genre.findById(req.params.id).exec();

  if (genre === null) {
    // 結果なし
    const err = new Error("ジャンルが見つかりません");
    err.status = 404;
    return next(err);
  }

  res.render("genre_form", { 
    title: "ジャンル更新", 
    genre: genre 
  });
});

// ジャンル更新をPOSTで処理
exports.genre_update_post = [
  // ジャンル名のバリデーションとサニタイズ
  body("name", "ジャンル名は3文字以上必要です")
    .trim()
    .isLength({ min: 3 })
    .escape(),

  // バリデーション後のリクエスト処理
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);

    // サニタイズされたデータと元のIDでジャンルオブジェクト作成
    const genre = new Genre({
      name: req.body.name,
      _id: req.params.id,
    });

    if (!errors.isEmpty()) {
      // エラーあり - フォームを再表示
      res.render("genre_form", {
        title: "ジャンル更新",
        genre: genre,
        errors: errors.array(),
      });
      return;
    } else {
      // データが有効 - レコードを更新
      await Genre.findByIdAndUpdate(req.params.id, genre);
      res.redirect(genre.url);
    }
  }),
];