import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [assets, setAssets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchAssets = async () => {
    try {
      const res = await axios.get(`${API_URL}/assets`);
      setAssets(res.data);
    } catch (err) {
      console.error('Failed to fetch assets', err);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleFileChange = (e) => {
    setSelectedFiles(e.target.files);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    const form = new FormData();
    Array.from(selectedFiles).forEach((file) => {
      form.append('files', file);
    });
    setUploading(true);
    setMessage('');
    try {
      const res = await axios.post(`${API_URL}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage(res.data.message || 'Upload successful');
      await fetchAssets();
    } catch (err) {
      console.error(err);
      setMessage('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const renderAsset = (asset) => {
    const ext = asset.filename.split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    const isVideo = ['mp4', 'mov', 'webm'].includes(ext);
    return (
      <div key={asset.filename} className="asset-card">
        {isImage && <img src={asset.url} alt={asset.displayName} className="thumb" />}
        {isVideo && (
          <video src={asset.url} controls className="thumb" />
        )}
        <div className="info">
          <strong>{asset.displayName}</strong>
          {asset.caption && <p>{asset.caption}</p>}
          {asset.hashtags && <p className="tags">{asset.hashtags}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="container">
      <h1>Instagram Post Uploader</h1>
      <section className="upload-section">
        <input type="file" multiple onChange={handleFileChange} />
        <button onClick={handleUpload} disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        {message && <p className="msg">{message}</p>}
      </section>
      <hr />
      <section className="assets-section">
        <h2>Your Assets</h2>
        <div className="assets-grid">
          {assets.map(renderAsset)}
        </div>
      </section>
    </div>
  );
}

export default App;
