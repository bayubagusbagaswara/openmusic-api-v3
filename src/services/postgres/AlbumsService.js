const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../../exceptions/InvariantError');
const { mapAlbumDBToModel, mapSongDBToModel } = require('../../utils');
const NotFoundError = require('../../exceptions/NotFoundError');

class AlbumsService {
  constructor() {
    this._pool = new Pool();
  }

  async addAlbum({ name, year }) {
    const id = `album-${nanoid(16)}`;
    const query = {
      text: 'INSERT INTO albums VALUES($1, $2, $3) RETURNING id',
      values: [id, name, year],
    };

    const result = await this._pool.query(query);
    if (!result.rows[0].id) {
      throw new InvariantError('Album gagal ditambahkan');
    }

    return result.rows[0].id;
  }

  async getAlbums() {
    try {
      const result = await this._cacheService.get('albums');
      return { albums: JSON.parse(result), isCache: 1 };
    } catch (error) {
      const query = {
        text: 'SELECT * FROM albums',
      };
      const { rows } = await this._pool.query(query);
      await this._cacheService.set('albums', JSON.stringify(rows));
      // return rows;
      return { albums: { ...rows } };
    }
  }

  async getAlbumById(id) {
    try {
      const result = await this._cacheService.get(`album:${id}`);
      return { album: JSON.parse(result), isCache: 1 };
    } catch (error) {
      const query = {
        text: 'SELECT * FROM albums WHERE id = $1',
        values: [id],
      };
      const { results } = await this._pool.query(query);

      if (!results.rows.length) {
        throw new NotFoundError('Album tidak ditemukan');
      }

      await this._cacheService.set(`album:${id}`, JSON.stringify(results[0]));
      return { album: { ...results.map(mapAlbumDBToModel)[0] } };
    }
  }

  async editAlbumById(id, { name, year }) {
    const query = {
      text: 'UPDATE albums SET name = $1, year = $2 WHERE id = $3 RETURNING id',
      values: [name, year, id],
    };
    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Gagal memperbarui album. Id tidak ditemukan');
    }
  }

  async deleteAlbumById(id) {
    const query = {
      text: 'DELETE FROM albums WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Album gagal dihapus. Id tidak ditemukan');
    }
  }

  async getSongsByAlbumId(id) {
    try {
      const result = await this._cacheService.get(`album-songs:${id}`);
      return { songs: JSON.parse(result), isCache: 1 };
    } catch (error) {
      const query = {
        text: 'SELECT id, title, performer FROM songs WHERE album_id = $1',
        values: [id],
      };
      const { results } = await this._pool.query(query);
      await this._cacheService.set(
        `album-songs:${id}`,
        JSON.stringify(results[0]),
      );
      return { songs: results.map(mapSongDBToModel) };
    }
  }

  /** ADD COVER ALBUM */
  async addAlbumCover(albumId, coverUrl) {
    const query = {
      text: 'UPDATE albums SET cover_url = $1 WHERE id = $2',
      values: [coverUrl, albumId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new InvariantError('Cover gagal ditambahkan');
    }
  }

  /** Likes Album */
  async addAlbumLike(albumId, userId) {
    const query = {
      text: 'SELECT * FROM user_album_likes WHERE album_id = $1 AND user_id = $2',
      values: [albumId, userId],
    };

    const result = await this._pool.query(query);

    // cek apakah album sudah punya like
    if (!result.rows.length) {
      // jika belum ada, maka lakukan like pada album
      await this.userLikeAlbums(userId, albumId);
    } else {
      // jika sudah ada, maka lakukan dislike pada album
      await this.userDislikeAlbums(userId, albumId);
    }
  }

  async userLikeAlbums(userId, albumId) {
    const id = `user_album_likes-${nanoid(16)}`;
    const query = {
      text: 'INSERT INTO user_album_likes (id, user_id, album_id) VALUES ($1, $2, $3)',
      values: [id, userId, albumId],
    };

    const result = await this._pool.query(query);
    if (!result.rows.length) {
      throw new InvariantError('Like gagal ditambahkan');
    }
  }

  async userDislikeAlbums(userId, albumId) {
    const query = {
      text: 'DELETE FROM user_album_likes WHERE album_id = $1 AND user_id = $2',
      values: [albumId, userId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new InvariantError('Like gagal dihapus');
    }
  }

  async getLikeAlbum(albumId) {
    try {
      const result = await this._cacheService.get(`likes:${albumId}`);
      return { likes: JSON.parse(result), isCache: 1 };
    } catch (error) {
      const query = {
        text: 'SELECT user_id FROM user_album_likes WHERE album_id = $1',
        values: [albumId],
      };
      const { results } = await this._pool.query(query);

      await this._cacheService.set(`likes:${albumId}`, JSON.stringify(results));

      return { likes: results };
    }
  }
}

module.exports = AlbumsService;
