"use client";

import { useState } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { checkAndCompleteTransaction, saveUploadedPhoto } from "@/lib/firestore";

interface UploadButtonProps {
  applicationId: string;
  nickname: string;
  onUploadComplete?: (url: string) => void;
}

export default function UploadButton({
  applicationId,
  nickname,
  onUploadComplete,
}: UploadButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setProgress(0);
    setUploadedUrl("");
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("업로드할 파일을 선택해주세요.");
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(
        storage,
        `nickname_uploads/${applicationId}_${nickname}_${Date.now()}_${selectedFile.name}`
      );
      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(pct);
        },
        (error) => {
          console.error(error);
          alert("❌ 업로드 실패, 다시 시도해주세요.");
          setUploading(false);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setUploadedUrl(downloadUrl);

          // Firestore에 URL 저장
          await saveUploadedPhoto(applicationId, nickname, downloadUrl);

          // 자동 정산 체크
          await checkAndCompleteTransaction(applicationId);

          if (onUploadComplete) onUploadComplete(downloadUrl);
          alert("✅ 인증 사진 업로드 및 전송 완료!");
          setSelectedFile(null);
          setUploading(false);
          setProgress(0);
        }
      );
    } catch (error) {
      console.error(error);
      alert("❌ 업로드 실패, 다시 시도해주세요.");
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
        className="w-full p-1 border rounded cursor-pointer disabled:bg-gray-200"
      />

      {selectedFile && (
        <div className="text-sm text-gray-700">
          선택된 파일: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
        </div>
      )}

      {uploading && (
        <div className="w-full bg-gray-200 rounded h-2">
          <div
            className="bg-blue-500 h-2 rounded"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={uploading || !selectedFile}
        className={`w-full p-2 rounded ${
          uploading || !selectedFile ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 text-white"
        }`}
      >
        {uploading ? `업로드 중... (${progress.toFixed(0)}%)` : "업로드"}
      </button>

      {uploadedUrl && (
        <a
          href={uploadedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-blue-600 underline break-all text-sm"
        >
          ✅ 업로드된 인증 사진 확인
        </a>
      )}
    </div>
  );
}
