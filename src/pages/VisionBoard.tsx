import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  GamepadIcon, 
  Zap, 
  Star, 
  Rocket, 
  Crown, 
  Brain, 
  Eye, 
  TrendingUp,
  Timer,
  Database,
  Search,
  AlertTriangle,
  Lightbulb,
  Target,
  Settings,
  Plus,
  Edit3,
  Trash2,
  Filter,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import FigureEnhancementManager from '@/components/FigureEnhancementManager';

interface Idea {
  id: string;
  name: string;
  description: string;
  category: 'game-changer' | 'premium' | 'core' | 'experimental' | 'parked';
  valueRating: 1 | 2 | 3 | 4 | 5;
  complexity: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high' | 'revolutionary';
  status: 'brainstormed' | 'in-development' | 'live' | 'parked';
  dateAdded: string;
  notes?: string;
}

const initialIdeas: Idea[] = [
  // Game Changers - The "Holy Grail" Features
  {
    id: '1',
    name: 'FEC Profit Maximizer AI',
    description: 'Transform the tool into a business intelligence platform that analyzes game performance, suggests optimal layouts, predicts maintenance needs, and provides revenue optimization strategies.',
    category: 'game-changer',
    valueRating: 5,
    complexity: 'high',
    impact: 'revolutionary',
    status: 'brainstormed',
    dateAdded: '2025-01-19',
    notes: 'THE CROWN JEWEL - Could turn cold calls into incoming phone calls'
  },
  {
    id: '2',
    name: 'AI-Powered Visual Diagnostics',
    description: 'Users upload photos/videos of malfunctioning machines and AI instantly identifies issues, provides step-by-step repair guides, and estimates repair costs.',
    category: 'game-changer',
    valueRating: 5,
    complexity: 'high',
    impact: 'revolutionary',
    status: 'brainstormed',
    dateAdded: '2025-01-19',
    notes: 'Revolutionary - no more guessing what\'s wrong'
  },
  {
    id: '3',
    name: 'Predictive Maintenance Oracle',
    description: 'AI analyzes usage patterns, environmental data, and historical maintenance to predict when machines will fail and what parts to order in advance.',
    category: 'game-changer',
    valueRating: 5,
    complexity: 'high',
    impact: 'revolutionary',
    status: 'brainstormed',
    dateAdded: '2025-01-19',
    notes: 'Prevent downtime before it happens'
  },

  // Premium Value-Adds
  {
    id: '4',
    name: 'FEC Command Center',
    description: 'Real-time dashboard showing all machines, their status, revenue performance, and maintenance schedules across multiple locations.',
    category: 'premium',
    valueRating: 4,
    complexity: 'medium',
    impact: 'high',
    status: 'brainstormed',
    dateAdded: '2025-01-19'
  },
  {
    id: '5',
    name: 'Hyper-Intelligent Knowledge Engine',
    description: 'AI that learns from every troubleshooting session and becomes smarter, providing increasingly accurate solutions over time.',
    category: 'premium',
    valueRating: 4,
    complexity: 'high',
    impact: 'high',
    status: 'brainstormed',
    dateAdded: '2025-01-19'
  },
  {
    id: '6',
    name: 'Emergency Response System',
    description: 'Immediate expert help via video call, AR overlays, and real-time guidance for critical machine failures.',
    category: 'premium',
    valueRating: 4,
    complexity: 'medium',
    impact: 'high',
    status: 'brainstormed',
    dateAdded: '2025-01-19'
  },

  // Core Enhancements
  {
    id: '7',
    name: 'Real-Time Processing Monitor',
    description: 'Live status tracking for manual uploads with progress bars, estimated completion times, and troubleshooting tools.',
    category: 'core',
    valueRating: 3,
    complexity: 'low',
    impact: 'medium',
    status: 'live',
    dateAdded: '2025-01-19',
    notes: 'Just implemented!'
  },
  {
    id: '8',
    name: 'Smart Search & Filtering',
    description: 'Advanced search capabilities with filters by game type, manufacturer, problem category, and difficulty level.',
    category: 'core',
    valueRating: 3,
    complexity: 'low',
    impact: 'medium',
    status: 'brainstormed',
    dateAdded: '2025-01-19'
  },

  // Experimental Ideas
  {
    id: '9',
    name: 'Time Machine Mode',
    description: 'Historical view of machine configurations and settings over time to identify what changed before problems started.',
    category: 'experimental',
    valueRating: 3,
    complexity: 'medium',
    impact: 'medium',
    status: 'brainstormed',
    dateAdded: '2025-01-19'
  },
  {
    id: '10',
    name: 'Competitor Analysis Tool',
    description: 'Track and analyze competitor locations, game selections, and pricing strategies.',
    category: 'experimental',
    valueRating: 2,
    complexity: 'high',
    impact: 'medium',
    status: 'brainstormed',
    dateAdded: '2025-01-19'
  }
];

const categories = {
  'game-changer': {
    name: 'Game Changers',
    icon: Crown,
    description: 'The "holy grail" breakthrough features',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20'
  },
  'premium': {
    name: 'Premium Value-Adds',
    icon: Rocket,
    description: 'High-impact features',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20'
  },
  'core': {
    name: 'Core Enhancements',
    icon: Settings,
    description: 'Solid improvements',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20'
  },
  'experimental': {
    name: 'Experimental Ideas',
    icon: Lightbulb,
    description: 'Wild concepts to explore',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20'
  },
  'parked': {
    name: 'Parked/Rejected',
    icon: AlertTriangle,
    description: 'Ideas we\'ve considered but set aside',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20'
  }
};

const VisionBoard = () => {
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIdea, setNewIdea] = useState<Partial<Idea>>({
    name: '',
    description: '',
    category: 'experimental',
    valueRating: 3,
    complexity: 'medium',
    impact: 'medium',
    status: 'brainstormed'
  });

  const filteredIdeas = selectedCategory 
    ? ideas.filter(idea => idea.category === selectedCategory)
    : ideas;

  const getValueStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-3 w-3 ${i < rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
      />
    ));
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'revolutionary': return 'text-purple-500 font-bold';
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live': return { variant: 'default' as const, label: 'Live', color: 'bg-green-500' };
      case 'in-development': return { variant: 'secondary' as const, label: 'In Development', color: 'bg-blue-500' };
      case 'brainstormed': return { variant: 'outline' as const, label: 'Brainstormed', color: 'bg-gray-500' };
      case 'parked': return { variant: 'destructive' as const, label: 'Parked', color: 'bg-red-500' };
      default: return { variant: 'outline' as const, label: status, color: 'bg-gray-500' };
    }
  };

  const addNewIdea = () => {
    if (!newIdea.name || !newIdea.description) return;
    
    const idea: Idea = {
      id: Date.now().toString(),
      name: newIdea.name,
      description: newIdea.description,
      category: newIdea.category as Idea['category'],
      valueRating: newIdea.valueRating as Idea['valueRating'],
      complexity: newIdea.complexity as Idea['complexity'],
      impact: newIdea.impact as Idea['impact'],
      status: newIdea.status as Idea['status'],
      dateAdded: new Date().toISOString().split('T')[0],
      notes: newIdea.notes
    };

    setIdeas(prev => [idea, ...prev]);
    setNewIdea({
      name: '',
      description: '',
      category: 'experimental',
      valueRating: 3,
      complexity: 'medium',
      impact: 'medium',
      status: 'brainstormed'
    });
    setShowAddForm(false);
  };

  return (
    <div className="min-h-screen arcade-bg">
      {/* Header */}
      <header className="border-b border-primary/20 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <GamepadIcon className="h-6 w-6 text-primary neon-glow" />
              <Crown className="h-5 w-5 text-yellow-500" />
              <h1 className="text-xl font-bold neon-text">VISION BOARD</h1>
              <Badge variant="outline" className="text-xs border-primary/30">
                CONFIDENTIAL
              </Badge>
            </div>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            {ideas.length} total ideas • {ideas.filter(i => i.status === 'live').length} live
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center space-y-6 mb-12">
          <h2 className="text-4xl font-bold neon-text">ARCADE FIX GURU</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            🎮 Innovation Laboratory • Feature Ideation Hub • Product Vision Board
          </p>
          <p className="text-lg text-primary max-w-2xl mx-auto">
            "The thing that transforms cold calls into incoming phone calls"
          </p>
        </div>

        {/* Figure Enhancement Tools */}
        <div className="mb-12 space-y-6">
          <h3 className="text-2xl font-bold text-center text-primary">Figure Enhancement</h3>
          <div className="flex justify-center">
            <FigureEnhancementManager />
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            <Filter className="h-4 w-4 mr-2" />
            All Ideas ({ideas.length})
          </Button>
          {Object.entries(categories).map(([key, category]) => {
            const IconComponent = category.icon;
            const count = ideas.filter(idea => idea.category === key).length;
            return (
              <Button
                key={key}
                variant={selectedCategory === key ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(key)}
                className={selectedCategory === key ? "" : `hover:${category.bgColor}`}
              >
                <IconComponent className={`h-4 w-4 mr-2 ${category.color}`} />
                {category.name} ({count})
              </Button>
            );
          })}
        </div>

        {/* Add New Idea Button */}
        <div className="flex justify-center mb-8">
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Idea</span>
          </Button>
        </div>

        {/* Add New Idea Form */}
        {showAddForm && (
          <Card className="border-primary/20 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Plus className="h-5 w-5 text-primary" />
                <span>Add New Idea</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={newIdea.name || ''}
                    onChange={(e) => setNewIdea(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Feature name..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select
                    value={newIdea.category}
                    onChange={(e) => setNewIdea(prev => ({ ...prev, category: e.target.value as Idea['category'] }))}
                    className="w-full p-2 border border-border rounded-md bg-background"
                  >
                    {Object.entries(categories).map(([key, category]) => (
                      <option key={key} value={key}>{category.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newIdea.description || ''}
                  onChange={(e) => setNewIdea(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the feature and its value..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Value Rating</label>
                  <select
                    value={newIdea.valueRating}
                    onChange={(e) => setNewIdea(prev => ({ ...prev, valueRating: parseInt(e.target.value) as Idea['valueRating'] }))}
                    className="w-full p-2 border border-border rounded-md bg-background"
                  >
                    {[1, 2, 3, 4, 5].map(rating => (
                      <option key={rating} value={rating}>{rating} Star{rating > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Complexity</label>
                  <select
                    value={newIdea.complexity}
                    onChange={(e) => setNewIdea(prev => ({ ...prev, complexity: e.target.value as Idea['complexity'] }))}
                    className="w-full p-2 border border-border rounded-md bg-background"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Impact</label>
                  <select
                    value={newIdea.impact}
                    onChange={(e) => setNewIdea(prev => ({ ...prev, impact: e.target.value as Idea['impact'] }))}
                    className="w-full p-2 border border-border rounded-md bg-background"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="revolutionary">Revolutionary</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Textarea
                  value={newIdea.notes || ''}
                  onChange={(e) => setNewIdea(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes or thoughts..."
                  rows={2}
                />
              </div>

              <div className="flex space-x-2">
                <Button onClick={addNewIdea}>Add Idea</Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ideas Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredIdeas.map((idea) => {
            const category = categories[idea.category];
            const IconComponent = category.icon;
            const statusBadge = getStatusBadge(idea.status);
            
            return (
              <Card
                key={idea.id}
                className={`${category.borderColor} hover:scale-105 transition-transform duration-200 ${category.bgColor}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2 flex-1">
                      <IconComponent className={`h-5 w-5 ${category.color}`} />
                      <CardTitle className="text-lg leading-tight">{idea.name}</CardTitle>
                    </div>
                    <Badge variant={statusBadge.variant} className="text-xs ml-2">
                      {statusBadge.label}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm">
                    {idea.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Value Rating */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Value:</span>
                    <div className="flex space-x-1">
                      {getValueStars(idea.valueRating)}
                    </div>
                  </div>

                  {/* Complexity & Impact */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Complexity:</span>
                      <div className={`font-medium ${getComplexityColor(idea.complexity)}`}>
                        {idea.complexity.toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Impact:</span>
                      <div className={`font-medium ${getImpactColor(idea.impact)}`}>
                        {idea.impact.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Date Added */}
                  <div className="text-xs text-muted-foreground border-t border-border pt-2">
                    Added: {new Date(idea.dateAdded).toLocaleDateString()}
                  </div>

                  {/* Notes */}
                  {idea.notes && (
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-sm italic">"{idea.notes}"</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredIdeas.length === 0 && (
          <div className="text-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No ideas in this category yet.</p>
          </div>
        )}

        {/* Stats Footer */}
        <div className="mt-16 p-6 bg-muted/30 rounded-lg border border-primary/10">
          <h3 className="text-lg font-semibold mb-4 text-center">Innovation Pipeline Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            {Object.entries(categories).map(([key, category]) => {
              const count = ideas.filter(idea => idea.category === key).length;
              const IconComponent = category.icon;
              return (
                <div key={key} className="space-y-2">
                  <IconComponent className={`h-6 w-6 ${category.color} mx-auto`} />
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm text-muted-foreground">{category.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default VisionBoard;