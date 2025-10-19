import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Upload, FileText, CheckCircle, AlertCircle, Lock } from 'lucide-react';
import { ProcessingMonitor } from './ProcessingMonitor';

interface UploadStatus {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  message?: string;
  job_id?: string;
  manual_id?: string;
}

interface ProcessingJob {
  job_id: string;
  manual_id: string;
  title: string;
}

export function ManualUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ status: 'idle' });
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [checkingAdmin, setCheckingAdmin] = useState<boolean>(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setCheckingAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        if (error) throw error;
        setIsAdmin(data || false);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast({
          title: 'Invalid file type',
          description: 'Please select a PDF file',
          variant: 'destructive',
        });
        return;
      }
      setFile(selectedFile);
      
      // Auto-generate title from filename if not set
      if (!title) {
        const filename = selectedFile.name.replace('.pdf', '');
        setTitle(filename.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please select a file and enter a title',
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to upload manuals',
        variant: 'destructive',
      });
      return;
    }

    setUploadStatus({ status: 'uploading', message: 'Uploading manual to storage...' });

    try {
      // Generate unique filename with user ID prefix for RLS
      const timestamp = Date.now();
      const sanitizedTitle = title.trim().replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${sanitizedTitle}_${timestamp}.pdf`;
      const filePath = `${user.id}/${fileName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('manuals')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      setUploadStatus({ status: 'uploading', message: 'Sending to LlamaCloud for processing...' });

      // Send storage path to edge function for LlamaCloud processing
      const { data, error } = await supabase.functions.invoke('upload-manual', {
        body: {
          title: title.trim(),
          storagePath: filePath,
        },
      });

      if (error) {
        throw error;
      }

      // Add to processing jobs list
      const newJob: ProcessingJob = {
        job_id: data.job_id,
        manual_id: data.manual_id,
        title: title.trim()
      };
      
      setProcessingJobs(prev => [newJob, ...prev]);

      setUploadStatus({
        status: 'completed',
        message: 'Upload successful! Processing has started.',
        job_id: data.job_id,
        manual_id: data.manual_id,
      });

      toast({
        title: 'Upload successful',
        description: 'Your manual is being processed. You can monitor progress below.',
      });

      // Reset form
      setFile(null);
      setTitle('');
      
      // Clear status after delay
      setTimeout(() => {
        setUploadStatus({ status: 'idle' });
      }, 5000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        status: 'error',
        message: error.message || 'Upload failed'
      });
      
      toast({
        title: 'Upload failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = () => {
    switch (uploadStatus.status) {
      case 'uploading':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />;
      case 'processing':
        return <div className="animate-pulse"><FileText className="h-4 w-4 text-blue-500" /></div>;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  if (checkingAdmin) {
    return (
      <Card className="border-primary/20">
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Checking permissions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <span>Upload Manual</span>
          </CardTitle>
          <CardDescription>
            Administrator access required
          </CardDescription>
        </CardHeader>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <p className="text-foreground font-medium">Admin Only</p>
              <p className="text-sm text-muted-foreground mt-2">
                Manual uploading is restricted to administrators.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5 text-primary" />
          <span>Upload Manual</span>
        </CardTitle>
        <CardDescription>
          Upload arcade game manuals for AI-powered troubleshooting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Game Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Street Fighter II, Ms. Pac-Man"
            disabled={uploadStatus.status === 'uploading' || uploadStatus.status === 'processing'}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="file">PDF Manual</Label>
          <Input
            id="file"
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            disabled={uploadStatus.status === 'uploading' || uploadStatus.status === 'processing'}
          />
          {file && (
            <p className="text-sm text-muted-foreground">
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {uploadStatus.status !== 'idle' && (
          <div className="flex items-center space-x-2 p-3 rounded-md bg-muted">
            {getStatusIcon()}
            <span className="text-sm">{uploadStatus.message}</span>
            {uploadStatus.manual_id && (
              <span className="text-xs text-muted-foreground">
                ID: {uploadStatus.manual_id}
              </span>
            )}
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={!file || !title.trim() || uploadStatus.status === 'uploading' || uploadStatus.status === 'processing'}
          className="w-full"
        >
          {uploadStatus.status === 'uploading' || uploadStatus.status === 'processing' ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
              {uploadStatus.status === 'uploading' ? 'Uploading...' : 'Processing...'}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Manual
            </>
          )}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Supported format: PDF files only</p>
          <p>• Processing includes OCR, image extraction, and intelligent chunking</p>
          <p>• Large manuals may take several minutes to process</p>
          <p>• You can leave this page while processing continues</p>
        </div>
      </CardContent>
    </Card>

    {/* Processing Jobs Monitor */}
    {processingJobs.length > 0 && (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Active Processing Jobs</h3>
        {processingJobs.map((job) => (
          <ProcessingMonitor
            key={job.job_id}
            job_id={job.job_id}
            manual_id={job.manual_id}
            onComplete={() => {
              // Remove from processing jobs when complete
              setProcessingJobs(prev => prev.filter(j => j.job_id !== job.job_id));
              toast({
                title: 'Processing complete',
                description: `${job.title} is now ready for search!`,
              });
            }}
          />
        ))}
      </div>
    )}
  </>
  );
}