import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

const ServerCapacity = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-16 w-16 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Server Over Capacity</h1>
          <p className="text-muted-foreground mb-6">
            We are sorry, our servers are currently over capacity. Please try again later.
          </p>
          <Button 
            onClick={() => navigate('/')} 
            variant="default"
            className="w-full"
          >
            Return to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ServerCapacity;
