import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

const BUCKET = 'proof-submissions';

const COMMON_PICKER_OPTIONS = {
  mediaTypes: ['images', 'videos'],
  quality: 0.8,
};

export async function pickMediaFromCamera() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Camera permission was denied.');
  }
  const result = await ImagePicker.launchCameraAsync({
    ...COMMON_PICKER_OPTIONS,
    videoMaxDuration: 60,
  });
  return result.canceled ? null : result.assets[0];
}

export async function pickMediaFromLibrary() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Media library permission was denied.');
  }
  const result = await ImagePicker.launchImageLibraryAsync(COMMON_PICKER_OPTIONS);
  return result.canceled ? null : result.assets[0];
}

function inferMediaType(asset) {
  return asset.type === 'video' ? 'video' : 'photo';
}

function inferMimeType(asset) {
  if (asset.mimeType) return asset.mimeType;
  return asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
}

function inferExtension(mimeType) {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('video/')) return 'mp4';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('heic')) return 'heic';
  if (mimeType.includes('webp')) return 'webp';
  return 'bin';
}

function buildObjectPath(dareId, mimeType) {
  const ext = inferExtension(mimeType);
  const random = Math.random().toString(36).slice(2, 10);
  return `${dareId}/${Date.now()}-${random}.${ext}`;
}

// Direct REST upload so we get progress events. supabase-js does not surface
// upload progress in v2.
function uploadWithProgress({ url, body, headers, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
        return;
      }
      let message = `Upload failed (${xhr.status})`;
      try {
        const parsed = JSON.parse(xhr.responseText);
        if (parsed?.message) message = parsed.message;
        else if (parsed?.error) message = parsed.error;
      } catch {
        if (xhr.responseText) {
          message += `: ${xhr.responseText.slice(0, 200)}`;
        }
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.onabort = () => reject(new Error('Upload aborted.'));
    xhr.open('POST', url);
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }
    xhr.send(body);
  });
}

export async function uploadProof({ dareId, asset, onProgress }) {
  if (!dareId) throw new Error('dareId is required.');
  if (!asset?.uri) throw new Error('No media to upload.');

  const mediaType = inferMediaType(asset);
  const mimeType = inferMimeType(asset);
  const path = buildObjectPath(dareId, mimeType);

  const fileResponse = await fetch(asset.uri);
  if (!fileResponse.ok) throw new Error('Could not read the selected media.');
  const blob = await fileResponse.blob();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) throw new Error('You must be signed in to upload proof.');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is not configured.');
  }

  const uploadUrl = `${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`;
  await uploadWithProgress({
    url: uploadUrl,
    body: blob,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': mimeType,
      'x-upsert': 'false',
    },
    onProgress,
  });

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data, error } = await supabase.rpc('submit_proof', {
    p_dare_id: dareId,
    p_media_url: publicUrl,
    p_media_type: mediaType,
  });
  if (error) throw error;

  return {
    submissionId: data?.submission_id ?? null,
    dareId: data?.dare_id ?? dareId,
    mediaUrl: publicUrl,
    mediaType,
    status: data?.status ?? 'awaiting_votes',
  };
}
